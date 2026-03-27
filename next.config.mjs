/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      // Entry/auth
      { source: '/', destination: '/html-files/index.html' },
      { source: '/auth', destination: '/html-files/index.html' },

      // Admin static feature parity
      { source: '/admin', destination: '/html-files/admin.html' },
      { source: '/admin/dashboard', destination: '/html-files/admin.html' },
      { source: '/admin/analytics', destination: '/html-files/admin.html' },
      { source: '/admin/accuracy', destination: '/html-files/admin.html' },
      { source: '/admin/audit', destination: '/html-files/admin-audit-deep-dive.html' },
      { source: '/admin/resources', destination: '/html-files/admin-resource-allocation.html' },
      { source: '/admin/users', destination: '/html-files/admin-user-management.html' },
      { source: '/admin/notifications', destination: '/html-files/notifications.html' },
      { source: '/admin/settings', destination: '/html-files/settings.html' },

      // Doctor static feature parity
      { source: '/doctor', destination: '/html-files/doctor.html' },
      { source: '/doctor/dashboard', destination: '/html-files/doctor.html' },
      { source: '/doctor/lab', destination: '/html-files/doctor-longitudinal-case.html' },
      { source: '/doctor/patients', destination: '/html-files/doctor-patient-records.html' },
      { source: '/doctor/schedule', destination: '/html-files/doctor-schedule.html' },
      { source: '/doctor/reports', destination: '/html-files/patient-report-detail.html' },
      { source: '/doctor/notifications', destination: '/html-files/notifications.html' },
      { source: '/doctor/settings', destination: '/html-files/settings.html' },

      // Patient static feature parity
      { source: '/patients', destination: '/html-files/patient.html' },
      { source: '/patients/dashboard', destination: '/html-files/patient.html' },
      { source: '/patients/reports', destination: '/html-files/patient-report-detail.html' },
      { source: '/patients/appointments', destination: '/html-files/patient.html' },
      { source: '/patients/medications', destination: '/html-files/patient.html' },
      { source: '/patients/notifications', destination: '/html-files/notifications.html' },
      { source: '/patients/settings', destination: '/html-files/settings.html' },

      // Shared utility/static pages
      { source: '/help', destination: '/html-files/help.html' },
      { source: '/notifications', destination: '/html-files/notifications.html' },
      { source: '/settings', destination: '/html-files/settings.html' },
      { source: '/profile/admin', destination: '/html-files/profile-admin.html' },
      { source: '/profile/doctor', destination: '/html-files/profile-doctor.html' },
      { source: '/profile/patient', destination: '/html-files/profile-patient.html' },
    ];
  },
};

export default nextConfig;
