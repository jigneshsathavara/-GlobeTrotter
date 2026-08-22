'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

type SharedTrip={id:string;name:string;startDate:string;endDate:string;description:string;budgetLimit:number;ownerName:string;stops:{id:string;cityName:string;country:string;startDate:string;endDate:string;activities:{id:string;title:string;category:string;cost:number;durationMinutes:number;notes:string;activityDate:string;startTime:string}[]}[]};
const date=(value:string)=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(`${value}T00:00:00`));

export default function SharedItinerary({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);const [trip,setTrip]=useState<SharedTrip|null>(null),[error,setError]=useState('');
  useEffect(()=>{fetch(`/api/globetrotter?share=${encodeURIComponent(id)}`).then(async(r)=>{const body=await r.json();if(!r.ok)setError(body.error);else setTrip(body.trip)}).catch(()=>setError('This itinerary could not be opened.'))},[id]);
  if(error)return <main className="shared-page shared-empty"><span className="brand-mark">G</span><h1>Route unavailable</h1><p>{error}</p><Link href="/">Plan your own trip</Link></main>;
  if(!trip)return <main className="shared-page shared-empty"><span className="brand-mark">G</span><p>Unfolding the itinerary…</p></main>;
  return <main className="shared-page"><header><Link href="/"><span className="brand-mark">G</span>GlobeTrotter</Link><span>Shared by {trip.ownerName}</span><Link className="shared-cta" href="/">Copy this trip</Link></header><section className="shared-hero"><div><p>PUBLIC ITINERARY</p><h1>{trip.name}</h1><span>{date(trip.startDate)} – {date(trip.endDate)}</span><p>{trip.description}</p></div><div className="shared-map">{trip.stops.map((stop,i)=><span key={stop.id}><b>{i+1}</b>{stop.cityName}</span>)}</div></section><section className="shared-content"><div className="shared-summary"><span><small>STOPS</small><b>{trip.stops.length}</b></span><span><small>ACTIVITIES</small><b>{trip.stops.flatMap((s)=>s.activities).length}</b></span><span><small>TRIP BUDGET</small><b>₹{trip.budgetLimit.toLocaleString('en-IN')}</b></span></div>{trip.stops.map((stop,i)=><article className="shared-stop" key={stop.id}><aside><b>{i+1}</b><i/></aside><div><p>{stop.country}</p><h2>{stop.cityName}</h2><span>{date(stop.startDate)} – {date(stop.endDate)}</span>{stop.activities.map((activity)=><section key={activity.id}><time>{activity.startTime||'Anytime'}</time><div><small>{activity.category}</small><h3>{activity.title}</h3><p>{activity.notes}</p><span>{activity.durationMinutes} min</span></div></section>)}</div></article>)}</section><footer>Planned with <strong>GlobeTrotter</strong> · Go farther, plan smarter, remember more.</footer></main>;
}
