require('dotenv').config()
var path = require('path')
const express = require('express')
const app = express()
var storage = require('azure-storage')
var blobService = storage.createBlobService(process.env.AZURE_URL);
const upload = require('multer')()

const CONTAINER_NAME = 'container'

app.get('/', (req, res) => getHTML().then(html => res.send(html)))

const mime = {
  html: 'text/html',
  txt: 'text/plain',
  css: 'text/css',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  js: 'application/javascript'
}

app.get('/image/:filename', (req, res) => {
  var file = path.basename(req.path)
  var type = mime[path.extname(file).slice(1)] || 'text/plain'

  res.set('Content-Type', type)

  blobService.getBlobToStream(CONTAINER_NAME, file, res, function (error, result, response) {
    if (error) {
      res.set('Content-Type', 'text/plain')
      res.status(404).end('Not found')
    }
    if (!error) {
      console.log('Sent')
    }
  })
})

app.post('/upload', upload.single('fileToUpload'), (req, res) => {
    // Create a container for organizing blobs within the storage account.

  console.log(req.file.originalname)
  blobService.createContainerIfNotExists(CONTAINER_NAME, function (error) {
    if (error) console.log(error)
    blobService.createBlockBlobFromStream(CONTAINER_NAME, req.file.originalname, bufferToStream(req.file.buffer), req.file.buffer.byteLength, () => console.log('Uploaded'))
  })

  res.redirect('/')
})

app.listen(3000, () => console.log('Example app listening on port 3000!'))

function getHTML () {
  return getImagesHTML()
    .then(imageHtml => {
      return `
      <!DOCTYPE html>
      <html>
      <body>
      
      <h3>Upload</h3>

      <form action="/upload" method="post" enctype="multipart/form-data">
          Select image to upload:
          <input type="file" name="fileToUpload" id="fileToUpload">
          <input type="submit" value="Upload Image" name="submit">
      </form>
      
      <h3>Current Images</h3>
      ${imageHtml}
      </body>
      </html>
      `
    })
}

let Duplex = require('stream').Duplex

function bufferToStream (buffer) {
  let stream = new Duplex()
  stream.push(buffer)
  stream.push(null)
  return stream
}

function getImagesHTML () {
  return listImages()
    .then(result => {
      console.log('Results to make img tags of: ' + result.length)
      return result.map(e => `<img src="/image/${e.name}" />`).join(' ')
    })
    .catch(e => console.log(e))
}

function listImages (token, images) {
  return new Promise(function (resolve, reject) {
    blobService.listBlobsSegmented(CONTAINER_NAME, token, undefined, function (error, result) {
      if (error) {
        reject(error)
        return
      }

      if (result.continuationToken) {
        return listImages(result.continuationToken, result.entries)
      } else {
        resolve(result.entries)
      }
    })
  })
}
