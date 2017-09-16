const emitStream = require('emit-stream')
const EventEmitter = require('events')
const { writeToClipboard } = require('../events')

// globals
// =

// emit-stream for download events, only one per document is needed
var dlEvents

// exported api
// =

module.exports = class DownloadsList extends EventEmitter {
  constructor () {
    super()

    // declare attributes
    this.downloads = []

    // bind the event handlers
    this.onNewDownload = e => this._onNewDownload(e)
    this.onUpdateDownload = e => this._onUpdateDownload(e)

    // wire up events
    if (!dlEvents) {
      dlEvents = emitStream(beaker.downloads.createEventsStream())
    }
    dlEvents.on('new-download', this.onNewDownload)
    dlEvents.on('updated', this.onUpdateDownload)
    dlEvents.on('done', this.onUpdateDownload)
  }

  setup () {
    // fetch downloads
    return beaker.downloads.getDownloads().then(downloads => {
      this.downloads = downloads
    })
  }

  destroy () {
    // unwire events
    this.removeAllListeners()
    dlEvents.removeListener('new-download', this.onNewDownload)
    dlEvents.removeListener('updated', this.onUpdateDownload)
    dlEvents.removeListener('done', this.onUpdateDownload)
  }

  // actions
  // =

  pauseDownload (download) {
    beaker.downloads.pause(download.id)
  }

  resumeDownload (download) {
    beaker.downloads.resume(download.id)
  }

  cancelDownload (download) {
    beaker.downloads.cancel(download.id)
  }

  copyDownloadLink (download) {
    writeToClipboard(download.url)
  }

  showDownload (download) {
    beaker.downloads.showInFolder(download.id)
      .catch(err => {
        download.fileNotFound = true
        this.emit('changed')
      })
  }

  openDownload (download) {
    beaker.downloads.open(download.id)
      .catch(err => {
        download.fileNotFound = true
        this.emit('changed')
      })
  }

  removeDownload (download) {
    beaker.downloads.remove(download.id)
    this.downloads.splice(this.downloads.indexOf(download), 1)
    this.emit('changed')
  }

  // event handlers
  // =

  _onNewDownload () {
    // do a little animation
    // TODO
  }

  _onUpdateDownload (download) {
    // patch data each time we get an update
    var target = this.downloads.find(d => d.id === download.id)
    if (target) {
      // patch item
      for (var k in download)
        target[k] = download[k]
    } else {
      this.downloads.push(download)
    }
    this.emit('changed')
  }
}
