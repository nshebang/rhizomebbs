module.exports = {
  apps: [
    {
      name: 'rhizomebbs',
      script: './src/index.js',
      max_memory_restart: '500M',
      //instances: 2, // uncomment only if cluster mode

      out_file: './bbs.log',
      error_file: './error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env_production: {
        NODE_ENV: 'production',
        exec_mode: 'fork', // you can change this to cluster if you want to do load balancing
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};
