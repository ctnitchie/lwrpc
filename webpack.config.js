const webpack = require('webpack');

module.exports = {
  entry: {
    app: './client/index.js',
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ],
  output: {
    path: __dirname + '/browser',
    filename: 'rpcClient.js'
  }
};
