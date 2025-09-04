import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    title: 'DooPush 帮助文档',
    description: 'DooPush推送平台完整使用指南',
    base: '/docs/',
    
    // 主题配置
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config

      logo: { 
        src: '/logo.svg', 
        width: 24, 
        height: 24
      },

      nav: [
        { text: '首页', link: '/' },
        { text: '快速开始', link: '/guide/quick-start', activeMatch: '^/guide/quick-start' },
        { text: '功能使用', link: '/guide/console', activeMatch: '^/guide/(?!quick-start)' },
        { text: 'API 文档', link: '/api/authentication', activeMatch: '^/api/' },
        { text: 'SDK 接入', link: '/sdk/ios-integration', activeMatch: '^/sdk/' }
      ],

      sidebar: {
        '/guide/': [
          {
            text: '功能使用指南',
            items: [
              { text: '快速开始', link: '/guide/quick-start' },
              { text: '控制台功能', link: '/guide/console' },
              { text: '应用管理', link: '/guide/apps' },
              { text: '设备管理', link: '/guide/devices' },
              { text: '推送功能', link: '/guide/push' },
              { text: '系统设置', link: '/guide/settings' }
            ]
          }
        ],
        '/api/': [
          {
            text: 'API 文档',
            items: [
              { text: 'API 认证', link: '/api/authentication' },
              { text: '推送接口', link: '/api/push-apis' },
              { text: '设备接口', link: '/api/device-apis' },
              { text: '数据接口', link: '/api/data-apis' }
            ]
          }
        ],
        '/sdk/': [
          {
            text: 'SDK 接入',
            items: [
              { text: 'iOS 集成', link: '/sdk/ios-integration' },
              { text: 'Android (开发中)', link: '/sdk/android-coming' }
            ]
          }
        ]
      },

      socialLinks: [
        { icon: 'github', link: 'https://github.com/doopush/doopush' }
      ],

      // 搜索配置
      search: {
        provider: 'local'
      },

      // 页面配置
      outline: {
        level: [2, 3],
        label: '目录'
      },

      // 编辑链接
      editLink: {
        pattern: 'https://github.com/doopush/doopush/edit/main/docs/:path',
        text: '在 GitHub 上编辑此页'
      },

      // 页脚
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2025 DooPush'
      }
    },

    // markdown 配置
    markdown: {
      lineNumbers: true
    },

    // 头部配置
    head: [
      ['link', { rel: 'icon', href: '/docs/favicon.ico' }]
    ],

    // 最后更新时间
    lastUpdated: true
  })
)
