const EventTarget = require('./event-target')

module.exports = class ProgressMonitor extends EventTarget {
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