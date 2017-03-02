const {throttle} = require('../functions')
const EventTarget = require('./event-target')

// constants
// =

// how much time to wait between throttle emits
const EMIT_CHANGED_WAIT = 30

// exported api
// =

module.exports = class LibraryDatArchive extends DatArchive {
  constructor (url) {
    super(url)

    // declare attributes
    this.info = null
    this.path = '/'
    this.files = {}
    this.history = []
    this.progress = null

    // wire up events
    this.fileActivity = this.createFileActivityStream()
    this.fileActivity.addEventListener('changed', this.onFileChanged.bind(this))
    this.fileActivity.addEventListener('invalidated', this.onFileInvalidated.bind(this))
    beaker.library.addEventListener('updated', (this.onLibraryUpdated = e => {
      if (e.details.url === this.url) {
        this.getInfo().then(info => {
          this.info = info
          this.emitChanged()
        })
      }
    }))

    // create a throttled 'change' emiter
    this.emitChanged = throttle(() => this.dispatchEvent({type: 'changed'}), EMIT_CHANGED_WAIT)
  }

  setup (path) {
    return Promise.all([
      this.getInfo().then(info => {
        this.info = info
        this.emitChanged()
        console.log(this.info)
      }),
      this.setPath(path)
    ])
  }

  setPath(path) {
    this.path = path || '/'
    return this.listFiles(this.path, {downloadedBlocks: true}).then(files => {
      this.files = files
      console.log(this.path, this.files)
      this.emitChanged()
    })
  }

  fetchHistory() {
    if (this.__fetchingHistory) return
    this.__fetchingHistory = true

    return this.listHistory().then(history => {
      this.history = history
      this.emitChanged()
    })
  }

  startMonitoringDownloadProgress() {
    if (this.progress) return Promise.resolve()
    this.progress = new ProgressMonitor(this)
    return this.progress.setup()
  }

  destroy () {
    // unwire events
    this.listeners = {}
    beaker.library.removeEventListener('updated', this.onLibraryUpdated)
    this.fileActivity.close()
    this.fileActivity = null
  }

  // getters
  //

  get key () {
    return this.url.slice('dat://'.length)
  }

  get niceName () {
    return this.info.title || 'Untitled'
  }

  get isSaved () {
    return this.info.userSettings.isSaved
  }

  get forkOf () {
    return this.info.forkOf && this.info.forkOf[0]
  }

  // utilities
  // =

  toggleSaved() {
    if (this.isSaved) {
      beaker.library.remove(this.url).then(() => {
        this.info.userSettings.isSaved = false
        this.emitChanged()
      })
    } else {
      beaker.library.add(this.url).then(() => {
        this.info.userSettings.isSaved = true
        this.emitChanged()
      })
    }
  }

  // event handlers
  // =

  onFileChanged(e) {
    this.setPath(this.path) // refetch files
    this.emitChanged()
  }

  onFileInvalidated(e) {
    this.setPath(this.path) // refetch files
    this.emitChanged()
  }
}

function trimLeadingSlash (str) {
  return str.replace(/^(\/)*/, '')
}


class ProgressMonitor extends EventTarget {
  constructor(archive) {
    super()
    this.archive = archive
    this.networkActivity = null
    this.downloadedBlocks = 0
    this.blocks = -1
    this.isDownloading = false

    // create a throttled 'change' emiter
    this.emitChanged = throttle(() => this.dispatchEvent({type: 'changed'}), EMIT_CHANGED_WAIT)
  }

  setup() {
    // start watching network activity
    this.networkActivity = this.archive.createNetworkActivityStream()
    this.networkActivity.addEventListener('download', this.onDownload.bind(this))
    this.interval = setInterval(() => this.fetchAllStats(), 10e3) // refetch stats every 10s
    return this.fetchAllStats()
  }

  fetchAllStats() {
    // fetch all file entries
    return this.archive.listFiles('/', {downloadedBlocks: true, depth: false}).then(allfiles => {
      // count blocks
      this.blocks = 0
      this.downloadedBlocks = 0
      for (var k in allfiles) {
        this.blocks += allfiles[k].blocks
        this.downloadedBlocks += allfiles[k].downloadedBlocks
      }
    })

  }

  destroy() {
    this.clearInterval(this.interval)
    this.listeners = {}
    if (this.networkActivity) {
      this.networkActivity.close()
    }
  }

  get current() {
    return Math.min(Math.round(this.downloadedBlocks / this.blocks * 100), 100)
  }

  get isComplete() {
    return this.downloadedBlocks >= this.blocks
  }

  onDownload(e) {
    // we dont need perfect precision --
    // rather than check if the block is one of ours, assume it is
    // we'll refetch the full stats every 10s to correct inaccuracies
    // (and we shouldnt be downloading historic data anyway)
    this.downloadedBlocks++

    // is this a block in one of our files?
    // for (var k in this.allfiles) {
    //   let file = this.allfiles[k]
    //   let block = e.block - file.content.blockOffset
    //   if (block >= 0 && block < file.blocks) {
    //     file.downloadedBlocks++
    //     this.downloadedBlocks++
    //   }
    // }
    this.emitChanged()
  }
}