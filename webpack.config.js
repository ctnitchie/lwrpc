const webpack = require('webpack');

module.exports = {
  entry: {
    app: './dist/client/index.js',
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ],
  output: {
    path: __dirname + '/dist/browser',
    filename: 'rpcClient.js'
  }
};
