var path = require('path')
var webpack = require('webpack')

const NODE_ENV = process.env.NODE_ENV

const md = require('markdown-it')(); // 引入markdown-it
const slugify = require('transliteration').slugify; // 引入transliteration中的slugify方法

const striptags = require('./strip-tags'); // 引入刚刚的工具类

/**
 * 由于cheerio在转换汉字时会出现转为Unicode的情况,所以我们编写convert方法来保证最终转码正确
 * @param  {[String]} str e.g  &#x6210;&#x529F;
 * @return {[String]}     e.g  成功
 */
function convert(str) {
  str = str.replace(/(&#x)(\w{4});/gi, function($0) {
    return String.fromCharCode(parseInt(encodeURIComponent($0).replace(/(%26%23x)(\w{4})(%3B)/g, '$2'), 16));
  });
  return str;
}

/**
 * 由于v-pre会导致在加载时直接按内容生成页面.但是我们想要的是直接展示组件效果,通过正则进行替换
 * hljs是highlight.js中的高亮样式类名
 * @param  {[type]} render e.g '<code v-pre class="test"></code>' | '<code></code>'
 * @return {[type]}        e.g '<code class="hljs test></code>'   | '<code class="hljs></code>'
 */
function wrap(render) {
  return function() {
    return render.apply(this, arguments)
      .replace('<code v-pre class="', '<code class="hljs ')
      .replace('<code>', '<code class="hljs">');
  };
}


module.exports = {
  // 修改打包入口
  entry: './src/main.js',

  output: {
    // path: path.resolve(__dirname, './dist'),
    path: path.resolve(__dirname, '../../../../static/labex-ui/'),
    publicPath: '/dist/',

    filename: 'labex-ui.js',
    library: 'labex-ui', // 指定的就是你使用require时的模块名
    libraryTarget: 'umd', // libraryTarget会生成不同umd的代码,可以只是commonjs标准的，也可以是指amd标准的，也可以只是通过script标签引入的
    umdNamedDefine: true // 会对 UMD 的构建过程中的 AMD 模块进行命名。否则就使用匿名的 define
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ],
      },
      {
        test: /\.scss$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'sass-loader'
        ],
      },
      {
        test: /\.sass$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'sass-loader?indentedSyntax'
        ],
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            'scss': [
              'vue-style-loader',
              'css-loader',
              'sass-loader'
            ],
            'sass': [
              'vue-style-loader',
              'css-loader',
              'sass-loader?indentedSyntax'
            ]
          }
          // other vue-loader options go here
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?[hash]'
        }
      },
      {
        test: /\.md$/,
        loader: 'vue-markdown-loader',
        options: {
          use: [
            [require('markdown-it-anchor'), {
              level: 5, // 添加超链接锚点的最小标题级别, 如: #标题 不会添加锚点
              slugify: slugify, // 自定义slugify, 我们使用的是将中文转为汉语拼音,最终生成为标题id属性
              permalink: true, // 开启标题锚点功能
              permalinkBefore: true // 在标题前创建锚点
            }],
            // 'markdown-it-container'的作用是自定义代码块

            [require('markdown-it-container'), 'demo', {
              // 当我们写::: demo :::这样的语法时才会进入自定义渲染方法
              validate: function (params) {
                return params.trim().match(/^demo\s*(.*)$/);
              },
              // 自定义渲染方法,这里为核心代码
              render: function (tokens, idx) {
                var m = tokens[idx].info.trim().match(/^demo\s*(.*)$/);
                // nesting === 1表示标签开始
                if (tokens[idx].nesting === 1) {
                  // 获取正则捕获组中的描述内容,即::: demo xxx中的xxx
                  var description = (m && m.length > 1) ? m[1] : '';
                  // 获得内容
                  var content = tokens[idx + 1].content;
                  // 解析过滤解码生成html字符串
                  var html = convert(striptags.strip(content, ['script', 'style'])).replace(/(<[^>]*)=""(?=.*>)/g, '$1');
                  // 获取script中的内容
                  var script = striptags.fetch(content, 'script');
                  // 获取style中的内容
                  var style = striptags.fetch(content, 'style');
                  // 组合成prop参数,准备传入组件
                  var jsfiddle = { html: html, script: script, style: style };
                  // 是否有描述需要渲染
                  var descriptionHTML = description
                    ? md.render(description)
                    : '';
                  // 将jsfiddle对象转换为字符串,并将特殊字符转为转义序列
                  jsfiddle = md.utils.escapeHtml(JSON.stringify(jsfiddle));
                  // 起始标签,写入demo-block模板开头,并传入参数
                  return `<demo-block class="demo-box" :jsfiddle="${jsfiddle}">
                            <div class="source" slot="source">${html}</div>
                            ${descriptionHTML}
                            <div class="highlight" slot="highlight">`;
                }
                // 否则闭合标签
                return '</div></demo-block>\n';
              }
            }],
            [require('markdown-it-container'), 'tip'],
            [require('markdown-it-container'), 'warning']
          ],
          // 定义处理规则
          preprocess: function (MarkdownIt, source) {
            // 对于markdown中的table,
            MarkdownIt.renderer.rules.table_open = function () {
              return '<table class="table">';
            };
            // 对于代码块去除v-pre,添加高亮样式
            MarkdownIt.renderer.rules.fence = wrap(MarkdownIt.renderer.rules.fence);
            return source;
          }
        }
      },]
  },
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    },
    extensions: ['*', '.js', '.vue', '.json']
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true,
    overlay: true
  },
  performance: {
    hints: false
  },
  devtool: '#eval-source-map'
}

if (process.env.NODE_ENV === 'production') {
  module.exports.devtool = '#source-map'
  // http://vue-loader.vuejs.org/en/workflow/production.html
  module.exports.plugins = (module.exports.plugins || []).concat([
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"'
      }
    }),
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      compress: {
        warnings: false
      }
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ])
}
