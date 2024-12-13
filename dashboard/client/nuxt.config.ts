// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@vueuse/nuxt', '@nuxt/icon', '@vesp/nuxt-fontawesome'],

  css: [
    '~/assets/css/main.css'
  ],

  app: {
    head: {
      title: 'CSDeploy Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Modern Deployment Dashboard' }
      ]
    }
  },

  runtimeConfig: {
    public: {
      socketUrl: process.env.SOCKET_URL || 'http://localhost:4000'
    }
  },

  devtools: { enabled: true },

  tailwindcss: {
    config: {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: '#2997FF',
            secondary: '#A855F7',
            dark: '#000000',
            'dark-accent': '#1D1D1F'
          }
        }
      }
    }
  },

  compatibilityDate: '2024-12-12'
})