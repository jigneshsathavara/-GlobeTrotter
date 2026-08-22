import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';

type DbEnv = typeof env & { DB: D1Database; UPLOADS: R2Bucket; JWT_SECRET?: string };
type Json = Record<string, unknown>;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT UNIQUE, email TEXT NOT NULL UNIQUE, phone TEXT, city TEXT, country TEXT, additional_info TEXT, password_hash TEXT NOT NULL, photo_url TEXT, language TEXT NOT NULL DEFAULT 'English', saved_destinations TEXT NOT NULL DEFAULT '[]', role TEXT NOT NULL DEFAULT 'traveler', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, description TEXT, cover_photo_url TEXT, is_public INTEGER NOT NULL DEFAULT 0, budget_limit REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stops (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, city_name TEXT NOT NULL, country TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE, title TEXT NOT NULL, category TEXT NOT NULL, cost REAL NOT NULL DEFAULT 0, duration_minutes INTEGER NOT NULL DEFAULT 60, notes TEXT, activity_date TEXT, start_time TEXT)`,
  `CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, category TEXT NOT NULL, amount REAL NOT NULL, day_date TEXT)`,
  `CREATE TABLE IF NOT EXISTS cities_catalog (id TEXT PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL, avg_cost_index REAL NOT NULL, popularity_score INTEGER NOT NULL, tagline TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS trips_user_idx ON trips(user_id)`,
  `CREATE INDEX IF NOT EXISTS stops_trip_idx ON stops(trip_id)`,
  `CREATE INDEX IF NOT EXISTS activities_stop_idx ON activities(stop_id)`,
];

const citySeed = [
  ['tokyo','Tokyo','Japan','Asia',88,100,'Neon nights, quiet shrines'],['kyoto','Kyoto','Japan','Asia',74,98,'Temples, tea and timeless lanes'],
  ['osaka','Osaka','Japan','Asia',68,92,'Street food and big-hearted energy'],['paris','Paris','France','Europe',92,99,'Art, light and long lunches'],
  ['lisbon','Lisbon','Portugal','Europe',62,91,'Tiled streets above the Atlantic'],['bled','Lake Bled','Slovenia','Europe',57,82,'A storybook lake beneath the Alps'],
  ['oaxaca','Oaxaca','Mexico','North America',49,88,'Color, craft and unforgettable flavor'],['marrakech','Marrakech','Morocco','Africa',54,91,'Courtyards, souks and desert light'],
  ['capetown','Cape Town','South Africa','Africa',59,93,'Mountain drama meets two oceans'],['queenstown','Queenstown','New Zealand','Oceania',78,89,'Big landscapes and bigger adventures'],
  ['bali','Ubud','Indonesia','Asia',43,96,'Rice terraces and creative calm'],['seoul','Seoul','South Korea','Asia',71,94,'Design-forward days and late-night bites'],
  ['istanbul','Istanbul','Türkiye','Europe',55,93,'Two continents, one magnetic city'],['reykjavik','Reykjavík','Iceland','Europe',96,87,'Northern light and elemental beauty'],
  ['amalfi','Amalfi Coast','Italy','Europe',89,95,'Cliffside villages over cobalt water'],['cusco','Cusco','Peru','South America',48,90,'Andean history at breathtaking height'],
  ['jaipur','Jaipur','India','Asia',38,90,'Rose-colored palaces and bazaars'],['goa','Goa','India','Asia',42,87,'Slow mornings beside the Arabian Sea'],
  ['sydney','Sydney','Australia','Oceania',90,94,'Harbour icons and beach-bound living'],['banff','Banff','Canada','North America',83,91,'Turquoise lakes in the wild Rockies'],
];

function db() { return (env as DbEnv).DB; }
function uploads() { return (env as DbEnv).UPLOADS; }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function text(value: unknown, fallback = '') { return typeof value === 'string' ? value.trim() : fallback; }
function number(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function validDateRange(start:string,end:string){return /^\d{4}-\d{2}-\d{2}$/.test(start)&&/^\d{4}-\d{2}-\d{2}$/.test(end)&&new Date(`${start}T00:00:00`).getTime()<=new Date(`${end}T00:00:00`).getTime();}
function profilePhotoKey(value:unknown){const match=String(value||'').match(/[?&]profilePhoto=([^&]+)/);if(!match)return '';try{const key=decodeURIComponent(match[1]);return key.startsWith('profile/')?key:''}catch{return ''}}

async function legacyHash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function passwordHash(value: string, salt=crypto.randomUUID().replaceAll('-','')) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256);
  const digest=Array.from(new Uint8Array(bits)).map((b)=>b.toString(16).padStart(2,'0')).join('');
  return `${salt}.${digest}`;
}
async function verifyPassword(value:string,stored:string){
  if(!stored.includes('.'))return stored===await legacyHash(value);
  const [salt]=stored.split('.');return stored===await passwordHash(value,salt);
}
function b64(value: string) { return btoa(unescape(encodeURIComponent(value))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function fromB64(value: string) { return decodeURIComponent(escape(atob(value.replaceAll('-','+').replaceAll('_','/')))); }
async function sign(payload: string) {
  const secret = (env as DbEnv).JWT_SECRET || 'globetrotter-local-hackathon-secret';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64(String.fromCharCode(...new Uint8Array(signature)));
}
async function tokenFor(userId: string) { const payload = b64(JSON.stringify({ sub:userId, exp:Date.now()+1000*60*60*24*7 })); return `${payload}.${await sign(payload)}`; }
async function userIdFrom(request: NextRequest) {
  const token = request.cookies.get('gt_token')?.value;
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || (await sign(payload)) !== signature) return null;
  try { const parsed = JSON.parse(fromB64(payload)) as { sub:string; exp:number }; return parsed.exp > Date.now() ? parsed.sub : null; } catch { return null; }
}

async function initialize() {
  const d1 = db();
  await d1.batch(schemaStatements.map((statement) => d1.prepare(statement)));
  const userColumns=(await d1.prepare('PRAGMA table_info(users)').all()).results.map((column)=>String(column.name));
  const missingColumns:[string,string][]=[['first_name','TEXT'],['last_name','TEXT'],['username','TEXT'],['phone','TEXT'],['city','TEXT'],['country','TEXT'],['additional_info','TEXT']];
  for(const [column,type] of missingColumns)if(!userColumns.includes(column))await d1.prepare(`ALTER TABLE users ADD COLUMN ${column} ${type}`).run();
  await d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)').run();
  const count = await d1.prepare('SELECT COUNT(*) AS count FROM cities_catalog').first<{count:number}>();
  if (!count?.count) await d1.batch(citySeed.map((city) => d1.prepare('INSERT INTO cities_catalog (id,name,country,region,avg_cost_index,popularity_score,tagline) VALUES (?,?,?,?,?,?,?)').bind(...city)));
  const demo = await d1.prepare('SELECT id FROM users WHERE email = ?').bind('demo@globetrotter.app').first<{id:string}>();
  if (!demo) await seedDemo();
  else await d1.prepare('UPDATE users SET first_name=COALESCE(first_name,?),last_name=COALESCE(last_name,?),username=COALESCE(username,?),phone=COALESCE(phone,?),city=COALESCE(city,?),country=COALESCE(country,?),additional_info=COALESCE(additional_info,?) WHERE id=?').bind('Alex','Morgan','alexmorgan','+91 98765 43210','New Delhi','India','Slow-travel enthusiast, food-market collector, and sunrise walker.','user_demo').run();
}

async function seedDemo() {
  const d1 = db(), userId='user_demo', tripId='trip_japan', stop1='stop_tokyo', stop2='stop_kyoto', stop3='stop_osaka';
  await d1.batch([
    d1.prepare('INSERT INTO users (id,name,first_name,last_name,username,email,phone,city,country,additional_info,password_hash,language,saved_destinations,role,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(userId,'Alex Morgan','Alex','Morgan','alexmorgan','demo@globetrotter.app','+91 98765 43210','New Delhi','India','Slow-travel enthusiast, food-market collector, and sunrise walker.',await passwordHash('wander123'),'English',JSON.stringify(['Kyoto','Lake Bled','Oaxaca']),'admin',now()),
    d1.prepare('INSERT INTO trips (id,user_id,name,start_date,end_date,description,is_public,budget_limit,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(tripId,userId,'Autumn through Japan','2026-09-29','2026-10-10','Temple mornings, neighborhood walks and the best bowls of ramen.',1,240000,now()),
    d1.prepare('INSERT INTO stops (id,trip_id,city_name,country,start_date,end_date,sort_order) VALUES (?,?,?,?,?,?,?)').bind(stop1,tripId,'Tokyo','Japan','2026-09-29','2026-10-03',0),
    d1.prepare('INSERT INTO stops (id,trip_id,city_name,country,start_date,end_date,sort_order) VALUES (?,?,?,?,?,?,?)').bind(stop2,tripId,'Kyoto','Japan','2026-10-04','2026-10-07',1),
    d1.prepare('INSERT INTO stops (id,trip_id,city_name,country,start_date,end_date,sort_order) VALUES (?,?,?,?,?,?,?)').bind(stop3,tripId,'Osaka','Japan','2026-10-08','2026-10-10',2),
    d1.prepare('INSERT INTO activities (id,stop_id,title,category,cost,duration_minutes,notes,activity_date,start_time) VALUES (?,?,?,?,?,?,?,?,?)').bind('act_sensoji',stop1,'Senso-ji at sunrise','culture',1200,120,'Arrive before the Nakamise shops open.','2026-09-30','07:00'),
    d1.prepare('INSERT INTO activities (id,stop_id,title,category,cost,duration_minutes,notes,activity_date,start_time) VALUES (?,?,?,?,?,?,?,?,?)').bind('act_teamlab',stop1,'teamLab Borderless','art',3800,150,'Book the first afternoon slot.','2026-10-01','14:00'),
    d1.prepare('INSERT INTO activities (id,stop_id,title,category,cost,duration_minutes,notes,activity_date,start_time) VALUES (?,?,?,?,?,?,?,?,?)').bind('act_fushimi',stop2,'Fushimi Inari hike','outdoors',0,180,'Take water and continue beyond the main viewpoint.','2026-10-05','06:30'),
    d1.prepare('INSERT INTO activities (id,stop_id,title,category,cost,duration_minutes,notes,activity_date,start_time) VALUES (?,?,?,?,?,?,?,?,?)').bind('act_gion',stop2,'Gion food walk','food',6500,180,'Small group evening tour.','2026-10-06','17:30'),
    d1.prepare('INSERT INTO activities (id,stop_id,title,category,cost,duration_minutes,notes,activity_date,start_time) VALUES (?,?,?,?,?,?,?,?,?)').bind('act_dotombori',stop3,'Dotonbori tasting trail','food',4200,150,'Save room for takoyaki and okonomiyaki.','2026-10-09','18:00'),
    d1.prepare('INSERT INTO expenses (id,trip_id,category,amount,day_date) VALUES (?,?,?,?,?)').bind('exp_flight',tripId,'transport',68000,'2026-09-29'),
    d1.prepare('INSERT INTO expenses (id,trip_id,category,amount,day_date) VALUES (?,?,?,?,?)').bind('exp_rail',tripId,'transport',22000,'2026-10-04'),
    d1.prepare('INSERT INTO expenses (id,trip_id,category,amount,day_date) VALUES (?,?,?,?,?)').bind('exp_stays',tripId,'stay',56200,'2026-09-29'),
    d1.prepare('INSERT INTO expenses (id,trip_id,category,amount,day_date) VALUES (?,?,?,?,?)').bind('exp_meals',tripId,'meal',16500,'2026-09-29'),
  ]);
}

async function appData(userId: string) {
  const d1=db();
  const user=await d1.prepare('SELECT id,name,first_name AS firstName,last_name AS lastName,username,email,phone,city,country,additional_info AS additionalInfo,photo_url AS photoUrl,language,saved_destinations AS savedDestinations,role,created_at AS createdAt FROM users WHERE id=?').bind(userId).first<Record<string,unknown>>();
  if (!user) return null;
  user.savedDestinations=JSON.parse(String(user.savedDestinations || '[]'));
  const trips=(await d1.prepare('SELECT id,name,start_date AS startDate,end_date AS endDate,description,cover_photo_url AS coverPhotoUrl,is_public AS isPublic,budget_limit AS budgetLimit,created_at AS createdAt FROM trips WHERE user_id=? ORDER BY start_date').bind(userId).all()).results as Record<string,unknown>[];
  const tripIds=trips.map((t)=>String(t.id));
  let stops:Record<string,unknown>[]=[] , activities:Record<string,unknown>[]=[] , expenses:Record<string,unknown>[]=[];
  if (tripIds.length) {
    const marks=tripIds.map(()=>'?').join(',');
    stops=(await d1.prepare(`SELECT id,trip_id AS tripId,city_name AS cityName,country,start_date AS startDate,end_date AS endDate,sort_order AS sortOrder FROM stops WHERE trip_id IN (${marks}) ORDER BY sort_order`).bind(...tripIds).all()).results as Record<string,unknown>[];
    const stopIds=stops.map((s)=>String(s.id));
    if(stopIds.length){const sm=stopIds.map(()=>'?').join(',');activities=(await d1.prepare(`SELECT id,stop_id AS stopId,title,category,cost,duration_minutes AS durationMinutes,notes,activity_date AS activityDate,start_time AS startTime FROM activities WHERE stop_id IN (${sm}) ORDER BY activity_date,start_time`).bind(...stopIds).all()).results as Record<string,unknown>[];}
    expenses=(await d1.prepare(`SELECT id,trip_id AS tripId,category,amount,day_date AS dayDate FROM expenses WHERE trip_id IN (${marks})`).bind(...tripIds).all()).results as Record<string,unknown>[];
  }
  trips.forEach((trip)=>{trip.isPublic=Boolean(trip.isPublic);trip.stops=stops.filter((s)=>s.tripId===trip.id).map((stop)=>({...stop,activities:activities.filter((a)=>a.stopId===stop.id)}));trip.expenses=expenses.filter((e)=>e.tripId===trip.id);});
  const cities=(await d1.prepare('SELECT id,name,country,region,avg_cost_index AS avgCostIndex,popularity_score AS popularityScore,tagline FROM cities_catalog ORDER BY popularity_score DESC').all()).results;
  const analytics={users:Number((await d1.prepare('SELECT COUNT(*) AS c FROM users').first<{c:number}>())?.c||0),trips:Number((await d1.prepare('SELECT COUNT(*) AS c FROM trips').first<{c:number}>())?.c||0),activities:Number((await d1.prepare('SELECT COUNT(*) AS c FROM activities').first<{c:number}>())?.c||0)};
  return {user,trips,cities,analytics};
}

export async function GET(request: NextRequest) {
  await initialize();
  const profilePhoto=request.nextUrl.searchParams.get('profilePhoto');
  if(profilePhoto){
    if(!profilePhoto.startsWith('profile/'))return NextResponse.json({error:'Invalid photo key'},{status:400});
    const object=await uploads().get(profilePhoto);if(!object)return NextResponse.json({error:'Photo not found'},{status:404});
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('cache-control','public, max-age=86400');
    return new Response(object.body,{headers});
  }
  const shareId=request.nextUrl.searchParams.get('share');
  if(shareId){
    const d1=db();
    const trip=await d1.prepare('SELECT t.id,t.name,t.start_date AS startDate,t.end_date AS endDate,t.description,t.budget_limit AS budgetLimit,u.name AS ownerName FROM trips t JOIN users u ON u.id=t.user_id WHERE t.id=? AND t.is_public=1').bind(shareId).first<Record<string,unknown>>();
    if(!trip)return NextResponse.json({error:'This itinerary is private or unavailable.'},{status:404});
    const stops=(await d1.prepare('SELECT id,city_name AS cityName,country,start_date AS startDate,end_date AS endDate,sort_order AS sortOrder FROM stops WHERE trip_id=? ORDER BY sort_order').bind(shareId).all()).results as Record<string,unknown>[];
    const stopIds=stops.map((s)=>String(s.id));let activities:Record<string,unknown>[]=[];
    if(stopIds.length){const marks=stopIds.map(()=>'?').join(',');activities=(await d1.prepare(`SELECT id,stop_id AS stopId,title,category,cost,duration_minutes AS durationMinutes,notes,activity_date AS activityDate,start_time AS startTime FROM activities WHERE stop_id IN (${marks}) ORDER BY activity_date,start_time`).bind(...stopIds).all()).results as Record<string,unknown>[];}
    stops.forEach((stop)=>{stop.activities=activities.filter((a)=>a.stopId===stop.id)});trip.stops=stops;
    return NextResponse.json({trip});
  }
  const userId=await userIdFrom(request);
  if(!userId) return NextResponse.json({error:'Unauthorized'},{status:401});
  const data=await appData(userId);
  if(!data) return NextResponse.json({error:'Account not found'},{status:404});
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  await initialize();
  if(request.nextUrl.searchParams.get('upload')==='profile'){
    const userId=await userIdFrom(request);if(!userId)return NextResponse.json({error:'Unauthorized'},{status:401});
    const contentType=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(contentType))return NextResponse.json({error:'Use a JPG, PNG or WEBP profile photo.'},{status:400});
    const photo=await request.arrayBuffer();if(!photo.byteLength)return NextResponse.json({error:'Choose an image to upload.'},{status:400});
    if(photo.byteLength>900*1024)return NextResponse.json({error:'The processed profile photo must be smaller than 900 KB.'},{status:400});
    const extension=contentType.split('/')[1]?.replace(/[^a-z0-9]/gi,'')||'img',key=`profile/${userId}/${crypto.randomUUID()}.${extension}`;
    const existing=await db().prepare('SELECT photo_url AS photoUrl FROM users WHERE id=?').bind(userId).first<{photoUrl:string}>();
    try{await uploads().put(key,photo,{httpMetadata:{contentType}})}catch{return NextResponse.json({error:'Photo storage is temporarily unavailable. Please try again.'},{status:503})}
    const photoUrl=`/api/globetrotter?profilePhoto=${encodeURIComponent(key)}`;
    await db().prepare('UPDATE users SET photo_url=? WHERE id=?').bind(photoUrl,userId).run();
    const oldKey=profilePhotoKey(existing?.photoUrl);if(oldKey&&oldKey!==key)await uploads().delete(oldKey).catch(()=>undefined);
    return NextResponse.json({ok:true,photoUrl});
  }
  if(request.headers.get('content-type')?.includes('multipart/form-data'))return NextResponse.json({error:'This upload method is no longer supported. Refresh the page and try again.'},{status:415});
  const body=(await request.json().catch(()=>({}))) as Json;
  const action=text(body.action);
  const d1=db();
  if(action==='signup'||action==='login'){
    const email=text(body.email).toLowerCase(), password=text(body.password), firstName=text(body.firstName), lastName=text(body.lastName), name=text(body.name,`${firstName} ${lastName}`.trim()||'Traveler'), requestedUsername=text(body.username).toLowerCase().replace(/[^a-z0-9._-]/g,''),username=(requestedUsername||email.split('@')[0].replace(/[^a-z0-9._-]/g,'')).slice(0,40);
    if((action==='signup'&&(!email.includes('@')||!firstName||!lastName||username.length<3))||password.length<6) return NextResponse.json({error:'Complete every required field and use a password of at least 6 characters.'},{status:400});
    let user=await d1.prepare('SELECT id,name,email,password_hash AS passwordHash FROM users WHERE email=? OR username=?').bind(email,email).first<{id:string;name:string;email:string;passwordHash:string}>();
    if(action==='signup'){
      if(user) return NextResponse.json({error:'An account with this email already exists.'},{status:409});
      const taken=await d1.prepare('SELECT id FROM users WHERE username=?').bind(username).first();if(taken)return NextResponse.json({error:'That username is already taken.'},{status:409});
      const userId=id('user');await d1.prepare('INSERT INTO users (id,name,first_name,last_name,username,email,phone,city,country,additional_info,photo_url,password_hash,language,saved_destinations,role,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(userId,name,firstName,lastName,username,email,text(body.phone),text(body.city),text(body.country),text(body.additionalInfo),text(body.photoUrl),await passwordHash(password),'English','[]','traveler',now()).run();
      user={id:userId,name,email,passwordHash:''};
    } else if(!user||!await verifyPassword(password,user.passwordHash)) return NextResponse.json({error:'Email or password is incorrect.'},{status:401});
    const response=NextResponse.json({ok:true,user:{id:user.id,name:user.name,email:user.email}});response.cookies.set('gt_token',await tokenFor(user.id),{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:60*60*24*7});return response;
  }
  if(action==='logout'){const response=NextResponse.json({ok:true});response.cookies.set('gt_token','',{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:0});return response;}
  const userId=await userIdFrom(request);if(!userId)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(action==='createTrip'){
    const name=text(body.name),startDate=text(body.startDate),endDate=text(body.endDate),budgetLimit=number(body.budgetLimit);if(!name||!validDateRange(startDate,endDate)||budgetLimit<0)return NextResponse.json({error:'Enter a trip name, a valid date range, and a non-negative budget.'},{status:400});
    const tripId=id('trip');await d1.prepare('INSERT INTO trips (id,user_id,name,start_date,end_date,description,cover_photo_url,is_public,budget_limit,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(tripId,userId,name,startDate,endDate,text(body.description),text(body.coverPhotoUrl),body.isPublic?1:0,budgetLimit,now()).run();
  } else if(action==='deleteTrip'){await d1.prepare('DELETE FROM trips WHERE id=? AND user_id=?').bind(text(body.tripId),userId).run();
  } else if(action==='updateTrip'){const name=text(body.name),startDate=text(body.startDate),endDate=text(body.endDate),budgetLimit=number(body.budgetLimit);if(!name||!validDateRange(startDate,endDate)||budgetLimit<0)return NextResponse.json({error:'Enter a trip name, a valid date range, and a non-negative budget.'},{status:400});await d1.prepare('UPDATE trips SET name=?,start_date=?,end_date=?,description=?,budget_limit=?,is_public=? WHERE id=? AND user_id=?').bind(name,startDate,endDate,text(body.description),budgetLimit,body.isPublic?1:0,text(body.tripId),userId).run();
  } else if(action==='addStop'){
    const owned=await d1.prepare('SELECT id,start_date AS startDate,end_date AS endDate FROM trips WHERE id=? AND user_id=?').bind(text(body.tripId),userId).first<{id:string;startDate:string;endDate:string}>();if(!owned)return NextResponse.json({error:'Trip not found'},{status:404});
    const cityName=text(body.cityName),country=text(body.country),startDate=text(body.startDate),endDate=text(body.endDate);if(!cityName||!country||!validDateRange(startDate,endDate)||startDate<owned.startDate||endDate>owned.endDate)return NextResponse.json({error:'Choose a city and dates that fall within the trip.'},{status:400});
    const max=await d1.prepare('SELECT COALESCE(MAX(sort_order),-1) AS m FROM stops WHERE trip_id=?').bind(text(body.tripId)).first<{m:number}>();
    await d1.prepare('INSERT INTO stops (id,trip_id,city_name,country,start_date,end_date,sort_order) VALUES (?,?,?,?,?,?,?)').bind(id('stop'),text(body.tripId),cityName,country,startDate,endDate,Number(max?.m??-1)+1).run();
  } else if(action==='deleteStop'){await d1.prepare('DELETE FROM stops WHERE id IN (SELECT s.id FROM stops s JOIN trips t ON t.id=s.trip_id WHERE s.id=? AND t.user_id=?)').bind(text(body.stopId),userId).run();
  } else if(action==='moveStop'){
    const stop=await d1.prepare('SELECT s.id,s.trip_id AS tripId,s.sort_order AS sortOrder FROM stops s JOIN trips t ON t.id=s.trip_id WHERE s.id=? AND t.user_id=?').bind(text(body.stopId),userId).first<{id:string;tripId:string;sortOrder:number}>();
    if(stop){const direction=number(body.direction);const other=await d1.prepare(`SELECT id,sort_order AS sortOrder FROM stops WHERE trip_id=? AND sort_order ${direction<0?'<':'>'} ? ORDER BY sort_order ${direction<0?'DESC':'ASC'} LIMIT 1`).bind(stop.tripId,stop.sortOrder).first<{id:string;sortOrder:number}>();if(other)await d1.batch([d1.prepare('UPDATE stops SET sort_order=? WHERE id=?').bind(other.sortOrder,stop.id),d1.prepare('UPDATE stops SET sort_order=? WHERE id=?').bind(stop.sortOrder,other.id)]);}
  } else if(action==='addActivity'){
    const owned=await d1.prepare('SELECT s.id,s.start_date AS startDate,s.end_date AS endDate FROM stops s JOIN trips t ON t.id=s.trip_id WHERE s.id=? AND t.user_id=?').bind(text(body.stopId),userId).first<{id:string;startDate:string;endDate:string}>();if(!owned)return NextResponse.json({error:'Stop not found'},{status:404});
    const title=text(body.title),activityDate=text(body.activityDate),cost=number(body.cost),duration=number(body.durationMinutes,60);if(!title||cost<0||duration<15||(activityDate&&(activityDate<owned.startDate||activityDate>owned.endDate)))return NextResponse.json({error:'Enter valid activity details within the stop dates.'},{status:400});
    await d1.prepare('INSERT INTO activities (id,stop_id,title,category,cost,duration_minutes,notes,activity_date,start_time) VALUES (?,?,?,?,?,?,?,?,?)').bind(id('act'),text(body.stopId),title,text(body.category,'culture'),cost,duration,text(body.notes),activityDate,text(body.startTime)).run();
  } else if(action==='deleteActivity'){await d1.prepare('DELETE FROM activities WHERE id IN (SELECT a.id FROM activities a JOIN stops s ON s.id=a.stop_id JOIN trips t ON t.id=s.trip_id WHERE a.id=? AND t.user_id=?)').bind(text(body.activityId),userId).run();
  } else if(action==='addExpense'){const trip=await d1.prepare('SELECT start_date AS startDate,end_date AS endDate FROM trips WHERE id=? AND user_id=?').bind(text(body.tripId),userId).first<{startDate:string;endDate:string}>();if(!trip)return NextResponse.json({error:'Trip not found'},{status:404});const amount=number(body.amount),dayDate=text(body.dayDate);if(amount<=0||(dayDate&&(dayDate<trip.startDate||dayDate>trip.endDate)))return NextResponse.json({error:'Enter a positive amount and a date within the trip.'},{status:400});await d1.prepare('INSERT INTO expenses (id,trip_id,category,amount,day_date) VALUES (?,?,?,?,?)').bind(id('exp'),text(body.tripId),text(body.category,'transport'),amount,dayDate).run();
  } else if(action==='updateProfile'){const name=text(body.name),username=text(body.username).toLowerCase().replace(/[^a-z0-9._-]/g,''),email=text(body.email).toLowerCase();if(!name||username.length<3||!email.includes('@'))return NextResponse.json({error:'Name, username, and a valid email are required.'},{status:400});const conflict=await d1.prepare('SELECT id FROM users WHERE (username=? OR email=?) AND id<>?').bind(username,email,userId).first();if(conflict)return NextResponse.json({error:'That username or email is already in use.'},{status:409});const parts=name.split(/\s+/),saved=Array.isArray(body.savedDestinations)?body.savedDestinations.map((item)=>text(item)).filter(Boolean):[];await d1.prepare('UPDATE users SET name=?,first_name=?,last_name=?,username=?,email=?,phone=?,city=?,country=?,additional_info=?,language=?,saved_destinations=? WHERE id=?').bind(name,text(body.firstName,parts[0]||''),text(body.lastName,parts.slice(1).join(' ')),username,email,text(body.phone),text(body.city),text(body.country),text(body.additionalInfo),text(body.language,'English'),JSON.stringify(saved),userId).run();
  } else if(action==='deleteAccount'){const existing=await d1.prepare('SELECT photo_url AS photoUrl FROM users WHERE id=?').bind(userId).first<{photoUrl:string}>();await d1.prepare('DELETE FROM users WHERE id=?').bind(userId).run();const oldKey=profilePhotoKey(existing?.photoUrl);if(oldKey)await uploads().delete(oldKey).catch(()=>undefined);const response=NextResponse.json({ok:true});response.cookies.set('gt_token','',{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:0});return response;
  } else return NextResponse.json({error:'Unknown action'},{status:400});
  return NextResponse.json(await appData(userId));
}
