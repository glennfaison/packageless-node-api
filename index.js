const http = require('http')
const https = require('https')
const url = require('url')
const fs = require('fs')
const StringDecoder = require('string_decoder').StringDecoder

const env = require('./config')

const httpServer = http.createServer((req, res) => {
  unifiedServer(req, res)
})

httpServer.listen(env.httpPort, () => {
  console.log(`Application is listening on port ${env.httpPort}, in ${env.envName} mode`)
})

const httpsOptions = {
  key: fs.readFileSync('./https/key.pem'),
  cert: fs.readFileSync('./https/cert.pem'),
}

const httpsServer = https.createServer(httpsOptions, (req, res) => {
  unifiedServer(req, res)
})

httpsServer.listen(env.httpsPort, () => {
  console.log(`Application is listening on port ${env.httpsPort}, in ${env.envName} mode`)
})

const unifiedServer = (req, res) => {

  const decoder = new StringDecoder('utf-8')
  let buffer = ''

  req.on('data', async (data) => {

    buffer += decoder.write(data)

  })

  req.on('end', async () => {

    buffer += decoder.end()

    const parsedUrl = url.parse(req.url, true)
    const path = parsedUrl.pathname
    const trimmedPath = path.replace(/^\/+|\/+$/g, '')
    req.method = req.method.toUpperCase()
    req.query = parsedUrl.query ? parsedUrl.query : {}
    req.headers = req.headers ? req.headers : {}
    req.body = buffer ? buffer : {}

    res.json = (data, status = 200) => {
      res.setHeader('content-type', 'application/json')
      res.writeHead(status)
      return res.end(JSON.stringify(data))
    }

    console.log(`Path: ${trimmedPath} with method: ${req.method}`)
    console.log(`Query params: ${JSON.stringify(req.query)}`)
    console.log(`Headers: ${JSON.stringify(req.headers)}`)
    console.log(`Payload: ${JSON.stringify(req.body)}`)

    if (!router[trimmedPath]) {
      handlers.notFoundHandler(req, res)
      return
    }
    router[trimmedPath](req, res)

  })

}

const handlers = {
  pingHandler: async (req, res) => {
    res.json({}, 200)
  },
  notFoundHandler: async (req, res) => {
    res.json('Resource was not found')
  },
}

const router = {
  'ping': handlers.pingHandler,
}