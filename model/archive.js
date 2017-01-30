const co = require('co')
const emitStream = require('emit-stream')
const EventEmitter = require('events')
const ArchiveFiles = require('./archive-files')
const { throttle } = require('../functions')

// constants
// =

// how much time to wait between throttle emits
const EMIT_CHANGED_WAIT = 30

// globals
// =

// emit-stream for archive events, only one per document is needed
var archivesEvents

// exported api
// =

module.exports = class Archive extends EventEmitter {
  constructor () {
    super()

    // declare attributes
    this.info = null
    this.files = null

    // wire up events
    if (!archivesEvents) {
      archivesEvents = emitStream(datInternalAPI.archivesEventStream())
    }
    this.createEventHandlers()
    archivesEvents.on('update-archive', this.handlers.onUpdateArchive)
    archivesEvents.on('update-listing', this.handlers.onUpdateListing)
    archivesEvents.on('download', this.handlers.onDownload)

    // create a throttled 'change' emiter
    this.emitChanged = throttle(() => this.emit('changed'), EMIT_CHANGED_WAIT)
  }

  fetchInfo (archiveKey) {
    var self = this
    return co(function * () {
      self.info = yield datInternalAPI.getArchiveDetails(archiveKey, {
        readme: true,
        entries: true,
        contentBitfield: true
      })
      self.files = (self.info) ? new ArchiveFiles(self.info) : null
      console.log(self.info)
      console.log(self.files)
    })
  }

  destroy () {
    // unwire events
    this.removeAllListeners()
    archivesEvents.removeListener('update-archive', this.handlers.onUpdateArchive)
    archivesEvents.removeListener('update-listing', this.handlers.onUpdateListing)
    archivesEvents.removeListener('download', this.handlers.onDownload)
  }

  // getters
  //

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

  openInExplorer() {
    datInternalAPI.openInExplorer(this.info.key)
  }

  toggleSaved() {
    if (this.isSaved) {
      datInternalAPI.setArchiveUserSettings(this.info.key, { isSaved: false }).then(settings => {
        this.info.userSettings.isSaved = false
        this.emitChanged()
      })
    } else {
      datInternalAPI.setArchiveUserSettings(this.info.key, { isSaved: true }).then(settings => {
        this.info.userSettings.isSaved = true
        this.emitChanged()
      })
    }
  }

  updateManifest({ title, description }) {
    // send write to the backend
    datInternalAPI.updateArchiveManifest(this.info.key, { title, description })
      .catch(console.warn.bind(console, 'Failed to update manifest'))
  }

  // event handlers
  // =

  createEventHandlers() {
    this.handlers = {
      onUpdateArchive: update => {
        if (this.info && update.key === this.info.key) {
          // patch the archive
          for (var k in update)
            this.info[k] = update[k]
          this.emitChanged()
        }
      },
      onUpdateListing: update => {
        if (this.info && update.key === this.info.key) {
          // simplest solution is just to refetch the entries
          this.fetchInfo(this.info.key)
        }
      },
      onDownload: update => {
        if (this.info && update.key === this.info.key && update.feed === 'content') {
          // increment root's downloaded blocks
          this.files.rootNode.entry.downloadedBlocks++

          // find the file and folders this update belongs to and increment their downloaded blocks
          for (var i=0; i < this.info.entries.length; i++) {
            var entry = this.info.entries[i]
            var index = update.index - entry.content.blockOffset
            if (index >= 0 && index < entry.blocks)
              entry.downloadedBlocks++ // update the entry
          }

          this.emitChanged()
        }
      }
    }
  }
}
