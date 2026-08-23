#!/usr/bin/env node
import { request } from 'node:http';
import { writeFileSync } from 'node:fs';

function post(opts, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = request({
      hostname: 'localhost', port: 8081, method: 'POST', ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: 'localhost', port: 8081, method: 'GET', path, headers }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.end();
  });
}

const r1 = await post({ path: '/api/v1/admin/login' }, { email: 'super@edushift.pe', password: 'SuperAdmin2026!' });
const login = JSON.parse(r1.body);
console.log('[login]', r1.status, 'reason=', login.reason);

let session;
if (login.reason === 'MFA_ENROLMENT_REQUIRED') {
  const r2 = await post({ path: '/api/v1/admin/dev/complete-mfa' }, null, {
    Authorization: `Bearer ${login.onboardingToken}`,
    'X-Dev-Code': 'dev-bypass',
  });
  console.log('[dev-mfa]', r2.status);
  if (r2.status !== 200) {
    console.log('  body:', r2.body.slice(0, 400));
    process.exit(1);
  }
  session = JSON.parse(r2.body).data.session;
} else if (login.accessToken) {
  session = { accessToken: login.accessToken, refreshToken: login.refreshToken };
} else if (login.session) {
  session = login.session;
} else {
  console.log('Unexpected login response:', r1.body);
  process.exit(1);
}

console.log('[session] accessToken?', !!session.accessToken);

// /auth/me as super_admin
const me = await get('/api/v1/auth/me', { Authorization: `Bearer ${session.accessToken}` });
console.log('[/auth/me]', me.status);
const user = JSON.parse(me.body).data;
console.log('  email=', user.email);
console.log('  roles=', user.roles);
console.log('  permissions.length=', user.permissions?.length);
console.log('  first 15 perms:', user.permissions?.slice(0, 15));

writeFileSync('C:/Users/USUARIO/Desktop/personales/proyectos/new - proyecto multi school/edushift/docs/qa/e2e-fe-by-role/2026-07-28-rerun/06-super-admin/super-admin-session.json', JSON.stringify({
  email: user.email,
  roles: user.roles,
  permissionsCount: user.permissions?.length,
  permissions: user.permissions,
  accessToken: session.accessToken,
  refreshToken: session.refreshToken,
}, null, 2));

console.log('\n--- Sample API calls as super_admin ---');

// List super admins
const list = await get('/api/admin/super-admins', { Authorization: `Bearer ${session.accessToken}` });
console.log('[list super-admins]', list.status);
if (list.status === 200) {
  const arr = JSON.parse(list.body).data;
  console.log('  count:', arr.length);
  arr.forEach(a => console.log(`   - ${a.email} (${a.firstName} ${a.lastName}) status=${a.status} mfa=${a.mfaEnabled}`));
}

const cnt = await get('/api/admin/super-admins/count-active', { Authorization: `Bearer ${session.accessToken}` });
console.log('[count-active]', cnt.status, '=', cnt.body);
