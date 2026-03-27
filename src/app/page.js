// src/app/page.js
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/auth'); return; }
    if (u.role === 'admin')   router.replace('/admin/dashboard');
    else if (u.role === 'doctor') router.replace('/doctor/dashboard');
    else router.replace('/patients/dashboard');
  }, []);
  return null;
}