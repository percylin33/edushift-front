const target = process.env['PROXY_TARGET'] || 'http://localhost:8081';

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
