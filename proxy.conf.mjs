const target = process.env['PROXY_TARGET'] || 'http://localhost:8080';

export default [
  {
    context: ['/api'],
    target,
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/api': '/api' },
    logLevel: 'debug',
  },
];
