﻿;(function(factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('jquery'), window, document)
  } else {
    factory(jQuery, window, document)
  }
})(function($, window, document, undefined) {
  var nextId = 1
  var cssPre = 'chocolat-'

  // Classes which should be removed upon destroy.
  var transientClasses = [
    cssPre + 'open',
    cssPre + 'in-container',
    cssPre + 'cover',
    cssPre + 'zoomable',
    cssPre + 'zoomed',
  ]

  function Chocolat($el, opts) {
    this.id = nextId++
    this.opts = opts
    this.ready = false
    this.images = []
    this.currentImage = null
    this.isFullScreen = false
    this.initialZoomState = null
    this.loaderDelay = null
    this.eventNS = '.chocolat-' + this.id

    if (!opts.setTitle && $el.data(cssPre + 'title')) {
      opts.setTitle = $el.data(cssPre + 'title')
    }

    this.$el = $el
    this.$sources = $el.find(opts.imageSelector)

    var self = this
    if (opts.images == null) {
      this.$sources.each(function(i) {
        var $this = $(this)
        if (opts.getImageOptions) {
          self.images.push(opts.getImageOptions($this))
          return
        }
        self.images.push({
          title: $this.attr('title'),
          src: $this.attr(opts.imageSource),
          height: false,
          width: false,
        })
      })
    }

    $el.on('click' + self.eventNS, opts.imageSelector, function(e) {
      e.preventDefault()
      self.open(self.$sources.index(this))
    })

    return this
  }

  $.extend(Chocolat.prototype, {
    open: function(i) {
      if (!this.ready) {
        this.ready = true
        this.markup()
        this.events()
        if (this.opts.onReady) {
          this.opts.onReady(this)
        }
      }
      return this.load(i)
    },

    close: function(callback) {
      if (this.isFullScreen) {
        this.exitFullScreen()
        if (!this.opts.fullScreen) return
      }

      var self = this
      this.currentImage = null
      this.$overlay
        .add(this.$loader)
        .add(this.$wrapper)
        .fadeOut(200, function() {
          self.$container.removeClass(cssPre + 'open')
          callback && callback()
        })
    },

    change: function(delta) {
      this.zoomOut(null, 0)
      this.zoomable()

      var imageCount = this.images.length
      var requestedImage = this.currentImage + parseInt(delta)
      if (requestedImage >= imageCount) {
        if (this.opts.loop) {
          return this.load(0)
        }
      } else if (requestedImage < 0) {
        if (this.opts.loop) {
          return this.load(imageCount - 1)
        }
      } else {
        return this.load(requestedImage)
      }
    },

    place: function(i, imgLoader) {
      this.storeImgSize(imgLoader, i)
      var dims = this.fit(i, this.$wrapper)
      return this.center(dims.width, dims.height, dims.left, dims.top, 0)
    },

    appear: function(i) {
      var self = this
      function showImage() {
        self.$img.attr('src', self.images[i].src)
      }
      if (this.$loader) {
        clearTimeout(this.loaderDelay)
        this.$loader.stop().fadeOut(300, showImage)
      } else {
        showImage()
      }
    },

    destroy: function() {
      this.$el.removeData('chocolat')
      if (this.ready) {
        this.ready = false
        this.currentImage = null

        this.exitFullScreen()

        this.$container.removeClass(transientClasses.join(' '))
        this.$wrapper.remove()

        // Remove event listeners
        this.$sources.off('click' + this.eventNS)
        this._events.forEach(function(event) {
          event.$target.off(event.type + this.eventNS)
        }, this)
        this._events = null
      }
    },

    /**
     * Initialization
     */

    markup: function() {
      this.$container = $(this.opts.container)
      this.$container.addClass(cssPre + 'open')

      if (this.opts.imageSize == 'cover') {
        this.$container.addClass(cssPre + 'cover')
      }
      if (this.opts.container !== window) {
        this.$container.addClass(cssPre + 'in-container')
      }

      this.$wrapper = $('<div/>', {
        class: cssPre + 'wrapper',
        id: cssPre + 'content-' + this.id,
      }).appendTo(this.$container)

      this.$overlay = $('<div/>', {
        class: cssPre + 'overlay',
      }).appendTo(this.$wrapper)

      if (!this.opts.hideLoader) {
        this.$loader = $('<div/>', {
          class: cssPre + 'loader',
        }).appendTo(this.$wrapper)
      }

      this.$content = $('<div/>', {
        class: cssPre + 'content',
      }).appendTo(this.$wrapper)

      this.$img = $('<img/>', {
        class: cssPre + 'img',
        src: '',
      }).appendTo(this.$content)

      this.$top = $('<div/>', {
        class: cssPre + 'top',
      }).appendTo(this.$wrapper)

      this.$prev = $('<div/>', {
        class: cssPre + 'left',
      }).appendTo(this.$wrapper)

      this.$next = $('<div/>', {
        class: cssPre + 'right',
      }).appendTo(this.$wrapper)

      this.$bottom = $('<div/>', {
        class: cssPre + 'bottom',
      }).appendTo(this.$wrapper)

      this.$close = $('<span/>', {
        class: cssPre + 'close',
      }).appendTo(this.$top)

      if (this.opts.fullScreen !== false) {
        this.$fullscreen = $('<span/>', {
          class: cssPre + 'fullscreen',
        }).appendTo(this.$bottom)
      }

      this.$description = $('<span/>', {
        class: cssPre + 'description',
      }).appendTo(this.$bottom)

      if (!this.opts.hidePagination) {
        this.$pagination = $('<span/>', {
          class: cssPre + 'pagination',
        }).appendTo(this.$bottom)
      }

      this.$setTitle = $('<span/>', {
        class: cssPre + 'set-title',
        html: this.opts.setTitle,
      }).appendTo(this.$bottom)

      if (this.opts.onMarkup) {
        this.opts.onMarkup(this)
      }
    },

    events: function() {
      var self = this
      self._events = []
      function on(target, type, fn) {
        if (type == 'resize') {
          fn = debounce(fn)
        }
        self._events.push({
          $target: $(target).on(type + this.eventNS, fn.bind(self)),
          type: type,
        })
      }

      on(window, 'resize', function() {
        if (this.currentImage !== null) {
          var dims = this.fit(this.currentImage, this.$wrapper)
          this.center(dims.width, dims.height, dims.left, dims.top, 0)
          this.zoomable()
        }
      })

      on(document, 'keydown', function(e) {
        if (this.ready && this.currentImage !== null) {
          if (e.keyCode == 37) {
            this.change(-1)
          } else if (e.keyCode == 39) {
            this.change(1)
          } else if (e.keyCode == 27) {
            this.close()
          }
        }
      })

      on(this.$next, 'click', function() {
        this.change(+1)
      })
      on(this.$prev, 'click', function() {
        this.change(-1)
      })

      on(this.$close, 'click', this.close)
      if (this.opts.backgroundClose) {
        on(this.$overlay, 'click', this.close)
      }

      if (this.$fullscreen) {
        on(this.$fullscreen, 'click', function() {
          if (this.isFullScreen) this.exitFullScreen()
          else this.openFullScreen()
        })
      }

      if (this.opts.enableZoom) {
        on(this.$wrapper, 'mousemove touchmove', this.onZoomPan)
        on(this.$wrapper, 'click', this.zoomOut)
        on(this.$img, 'click', function(e) {
          if (this.initialZoomState !== null) return
          if (this.$container.hasClass(cssPre + 'zoomable')) {
            e.stopPropagation()
            this.zoomIn(e)
          }
        })
      }
    },

    /**
     * Components
     */

    arrows: function() {
      if (this.opts.loop) {
        this.$prev.add(this.$next).addClass('active')
      } else if (this.opts.linkImages) {
        // right
        if (this.currentImage == this.images.length - 1) {
          this.$next.removeClass('active')
        } else {
          this.$next.addClass('active')
        }
        // left
        if (this.currentImage === 0) {
          this.$prev.removeClass('active')
        } else {
          this.$prev.addClass('active')
        }
      } else {
        this.$prev.add(this.$next).removeClass('active')
      }
    },

    description: function() {
      this.$description.html(this.images[this.currentImage].title)
    },

    pagination: function() {
      var index = this.currentImage + 1
      var imageCount = this.images.length
      this.$pagination.html(index + ' / ' + imageCount)
    },

    /**
     * Image loading
     */

    load: function(i) {
      if (this.opts.fullScreen == true) {
        this.openFullScreen()
      }

      var isReveal = this.currentImage == null
      if (isReveal) {
        this.$overlay.fadeIn(this.opts.duration)
        this.$wrapper.fadeIn(this.opts.duration)
        this.$container.addClass(cssPre + 'open')
      }

      if (this.currentImage === i) return
      this.currentImage = i

      // Hide previous image while loading
      this.$img.attr('src', '#')

      this.description()
      this.arrows()
      if (this.$pagination) {
        this.pagination()
      }

      var self = this
      if (this.$loader) {
        // Fade in loader after short delay
        var delay = 100 + (isReveal ? this.opts.duration : 0)
        this.loaderDelay = setTimeout(function() {
          self.$loader.fadeIn()
        }, delay)
      }

      var deferred = this.preload(i)
        .then(function(imgLoader) {
          return self.place(i, imgLoader)
        })
        .then(function(imgLoader) {
          return self.appear(i)
        })
        .then(function(imgLoader) {
          self.zoomable()
          if (self.opts.onImageLoad) {
            self.opts.onImageLoad(self)
          }
        })

      var nextIndex = i + 1
      if (typeof this.images[nextIndex] != 'undefined') {
        this.preload(nextIndex)
      }

      return deferred
    },

    preload: function(i) {
      var def = $.Deferred()

      if (typeof this.images[i] === 'undefined') {
        return
      }
      var imgLoader = new Image()
      imgLoader.onload = function() {
        def.resolve(imgLoader)
      }
      imgLoader.src = this.images[i].src

      return def
    },

    /**
     * Image sizing
     */

    center: function(width, height, left, top, duration) {
      return this.$content
        .css('overflow', 'visible')
        .animate(
          {
            width: width,
            height: height,
            left: left,
            top: top,
          },
          duration
        )
        .promise()
    },

    fit: function(i, container) {
      var height
      var width

      var imgHeight = this.images[i].height
      var imgWidth = this.images[i].width
      var holderHeight = $(container).height()
      var holderWidth = $(container).width()
      var holderOutMarginH = this.getOutMarginH()
      var holderOutMarginW = this.getOutMarginW()

      var holderGlobalWidth = holderWidth - holderOutMarginW
      var holderGlobalHeight = holderHeight - holderOutMarginH
      var holderGlobalRatio = holderGlobalHeight / holderGlobalWidth
      var holderRatio = holderHeight / holderWidth
      var imgRatio = imgHeight / imgWidth

      if (this.opts.imageSize == 'cover') {
        if (imgRatio < holderRatio) {
          height = holderHeight
          width = height / imgRatio
        } else {
          width = holderWidth
          height = width * imgRatio
        }
      } else if (this.opts.imageSize == 'native') {
        height = imgHeight
        width = imgWidth
      } else {
        if (imgRatio > holderGlobalRatio) {
          height = holderGlobalHeight
          width = height / imgRatio
        } else {
          width = holderGlobalWidth
          height = width * imgRatio
        }
        if (
          this.opts.imageSize === 'default' &&
          (width >= imgWidth || height >= imgHeight)
        ) {
          width = imgWidth
          height = imgHeight
        }
      }

      return {
        height: height,
        width: width,
        top: (holderHeight - height) / 2,
        left: (holderWidth - width) / 2,
      }
    },

    storeImgSize: function(img, i) {
      if (typeof img === 'undefined') return
      var meta = this.images[i]
      if (!meta.width || !meta.height) {
        meta.width = img.width
        meta.height = img.height
      }
    },

    getOutMarginW: function() {
      var left = this.$prev.outerWidth(true)
      var right = this.$next.outerWidth(true)
      return left + right
    },

    getOutMarginH: function() {
      return this.$top.outerHeight(true) + this.$bottom.outerHeight(true)
    },

    /**
     * Fullscreen mode
     */

    openFullScreen: function() {
      if (this.isFullScreen) return
      this.isFullScreen = true

      var wrapper = this.$wrapper[0]
      if (wrapper.requestFullscreen) {
        wrapper.requestFullscreen()
      } else if (wrapper.mozRequestFullScreen) {
        wrapper.mozRequestFullScreen()
      } else if (wrapper.webkitRequestFullscreen) {
        wrapper.webkitRequestFullscreen()
      } else if (wrapper.msRequestFullscreen) {
        wrapper.msRequestFullscreen()
      } else {
        this.isFullScreen = false
      }
    },

    exitFullScreen: function() {
      if (!this.isFullScreen) return
      this.isFullScreen = false

      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
    },

    /**
     * Zoom mode
     */

    zoomable: function() {
      var currentImage = this.images[this.currentImage]
      var wrapperWidth = this.$wrapper.width()
      var wrapperHeight = this.$wrapper.height()

      var isImageZoomable =
        this.opts.enableZoom &&
        (currentImage.width > wrapperWidth ||
          currentImage.height > wrapperHeight)
          ? true
          : false
      var isImageStretched =
        this.$img.width() > currentImage.width ||
        this.$img.height() > currentImage.height

      if (isImageZoomable && !isImageStretched) {
        this.$container.addClass(cssPre + 'zoomable')
      } else {
        this.$container.removeClass(cssPre + 'zoomable')
      }
    },

    zoomIn: function(e, duration) {
      if (this.initialZoomState !== null) return
      if (this.currentImage == null) return
      duration = duration || this.opts.duration

      this.initialZoomState = this.opts.imageSize
      this.opts.imageSize = 'native'
      this.onZoomPan({
        pageX: e.pageX,
        pageY: e.pageY,
        duration: duration,
      })

      this.$container.addClass(cssPre + 'zoomed')
      var dims = this.fit(this.currentImage, this.$wrapper)
      return this.center(dims.width, dims.height, dims.left, dims.top, duration)
    },

    zoomOut: function(e, duration) {
      if (this.initialZoomState === null) return
      if (this.currentImage == null) return
      duration = duration || this.opts.duration

      this.opts.imageSize = this.initialZoomState
      this.initialZoomState = null

      this.$img.animate({ margin: 0 }, duration)
      this.$container.removeClass(cssPre + 'zoomed')

      var dims = this.fit(this.currentImage, this.$wrapper)
      return this.center(dims.width, dims.height, dims.left, dims.top, duration)
    },

    onZoomPan: function(e) {
      if (this.initialZoomState === null) return
      if (this.$img.is(':animated')) return

      var pos = this.$wrapper.offset()
      var height = this.$wrapper.height()
      var width = this.$wrapper.width()

      var currentImage = this.images[this.currentImage]
      var imgWidth = currentImage.width
      var imgHeight = currentImage.height

      var coord = [
        e.pageX - width / 2 - pos.left,
        e.pageY - height / 2 - pos.top,
      ]

      var mvtX = 0
      if (imgWidth > width) {
        var paddingX = this.opts.zoomedPaddingX(imgWidth, width)
        mvtX = coord[0] / (width / 2)
        mvtX = ((imgWidth - width) / 2 + paddingX) * mvtX
      }

      var mvtY = 0
      if (imgHeight > height) {
        var paddingY = this.opts.zoomedPaddingY(imgHeight, height)
        mvtY = coord[1] / (height / 2)
        mvtY = ((imgHeight - height) / 2 + paddingY) * mvtY
      }

      var animation = {
        'margin-left': -mvtX + 'px',
        'margin-top': -mvtY + 'px',
      }
      if (typeof e.duration !== 'undefined') {
        this.$img.stop(false, true).animate(animation, e.duration)
      } else {
        this.$img.stop(false, true).css(animation)
      }
    },
  })

  function debounce(fn) {
    var timer
    return function() {
      var ctx = this
      var args = [].slice.call(arguments)

      clearTimeout(timer)
      timer = setTimeout(function() {
        fn.apply(ctx, args)
        timer = null
      }, 50)
    }
  }

  var defaults = {
    container: 'body',
    imageSelector: '.chocolat-image',
    imageSource: 'href',
    imageSize: 'default', // 'default', 'contain', 'cover' or 'native'
    fullScreen: null,
    loop: false,
    linkImages: true,
    duration: 300,
    setTitle: '',
    enableZoom: false,
    hideLoader: false,
    hidePagination: false,
    zoomedPaddingX: function(canvasWidth, imgWidth) {
      return 0
    },
    zoomedPaddingY: function(canvasHeight, imgHeight) {
      return 0
    },
  }

  $.fn.chocolat = function(opts) {
    if (arguments.length == 0) {
      return $.data(this[0], 'chocolat')
    }
    return this.each(function() {
      var instance = $.data(this, 'chocolat')
      if (instance) instance.destroy()

      instance = new Chocolat($(this), $.extend(true, {}, defaults, opts))
      $.data(this, 'chocolat', instance)
    })
  }
})
