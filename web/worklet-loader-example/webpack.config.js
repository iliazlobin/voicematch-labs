{
  module: {
    rules: [
      {
        test: /\.worklet\.js$/,
        use: { loader: 'worklet-loader' }
      }
    ]
  }
}