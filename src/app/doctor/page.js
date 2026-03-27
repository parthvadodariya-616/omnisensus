'use client';
import{useEffect}from'react';import{useRouter}from'next/navigation';
export default function DoctorRoot(){const router=useRouter();useEffect(()=>{router.replace('/doctor/dashboard');},[]);return null;}
