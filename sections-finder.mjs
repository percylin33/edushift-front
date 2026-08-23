#!/usr/bin/env node
const loginRes = await fetch('http://localhost:8081/api/v1/auth/login', {
  method: 'POST',
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'lucia.student@tecnosur.edushift.pe', password: 'EduShift2026!' }),
});
const loginBody = await loginRes.json();
const tok = loginBody.accessToken;

const meRes = await fetch('http://localhost:8081/api/v1/users/me', {
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Authorization': `Bearer ${tok}` },
});
const meBody = await meRes.json();
console.log('me.publicUuid =', meBody.data?.publicUuid);
console.log('me.roles =', meBody.data?.roles);

for (const path of ['/api/v1/lms/me/sections', '/api/v1/lms/students/me/assignments', '/api/v1/lms/sections']) {
  const r = await fetch(`http://localhost:8081${path}`, {
    headers: { 'X-Tenant-Slug': 'tecnosur', 'Authorization': `Bearer ${tok}` },
  });
  const j = await r.json();
  console.log(`${path} =`, r.status, JSON.stringify(j).slice(0, 400));
}