'use client';
import{useEffect}from'react';import{useRouter}from'next/navigation';
export default function PatientRoot(){const router=useRouter();useEffect(()=>{router.replace('/patients/dashboard');},[]);return null;}
