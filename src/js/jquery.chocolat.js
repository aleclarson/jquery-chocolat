﻿;(function(factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('jquery'), window, document)
  } else {
    factory(jQuery, window, document)
  }
})(function($, window, document, undefined) {
  var nextId = 1

  // Classes which should be removed upon destroy.
  var transientClasses = [
    'chocolat-open',
    'chocolat-in-container',
    'chocolat-cover',
    'chocolat-zoomable',
    'chocolat-zoomed',
  ]

  function Chocolat($el, opts) {
    var self = this

    this.id = nextId++
    this.$el = $el
    this.opts = opts
    this.initialized = false
    this.currentImage = null
    this.isFullScreen = false
    this.initialZoomState = null
    this.eventNS = '.chocolat-' + this.id

    if (!this.opts.setTitle && $el.data('chocolat-title')) {
      this.opts.setTitle = $el.data('chocolat-title')
    }

    this.$el.find(this.opts.imageSelector).each(function() {
      var $this = $(this)
      self.opts.images.push({
        title: $this.attr('title'),
        src: $this.attr(self.opts.imageSource),
        height: false,
        width: false,
      })
      $this.on('click' + this.eventNS, function(e) {
        self.init(i)
        e.preventDefault()
      })
    })

    return this
  }

  $.extend(Chocolat.prototype, {
    init: function(i) {
      if (!this.initialized) {
        this.initialized = true
        this.setDomContainer()
        this.markup()
        this.events()
        if (this.opts.onReady) {
          this.opts.onReady(this)
        }
      }
      return this.load(i)
    },

    preload: function(i) {
      var def = $.Deferred()

      if (typeof this.opts.images[i] === 'undefined') {
        return
      }
      var imgLoader = new Image()
      imgLoader.onload = function() {
        def.resolve(imgLoader)
      }
      imgLoader.src = this.opts.images[i].src

      return def
    },

    load: function(i) {
      var self = this
      if (this.opts.fullScreen == true) {
        this.openFullScreen()
      }

      if (this.currentImage === i) {
        return
      }

      this.$overlay.fadeIn(this.opts.duration)
      this.$wrapper.fadeIn(this.opts.duration)
      this.$container.addClass('chocolat-open')

      if (this.opts.showLoader) {
        this.opts.timer = setTimeout(function() {
          $.proxy(self.$loader.fadeIn(), self)
        }, this.opts.duration)
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
      if (typeof this.opts.images[nextIndex] != 'undefined') {
        this.preload(nextIndex)
      }

      return deferred
    },

    place: function(i, imgLoader) {
      var self = this
      var fitting

      this.currentImage = i
      this.description()
      this.arrows()
      if (this.opts.showPagination) {
        this.pagination()
      }

      this.storeImgSize(imgLoader, i)
      fitting = this.fit(i, self.$wrapper)

      return this.center(
        fitting.width,
        fitting.height,
        fitting.left,
        fitting.top,
        0
      )
    },

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

    appear: function(i) {
      var self = this
      clearTimeout(this.opts.timer)
      function showImage() {
        self.$img.attr('src', self.opts.images[i].src)
      }

      if (this.opts.showLoader) {
        this.$loader.stop().fadeOut(300, showImage)
      } else {
        showImage()
      }
    },

    fit: function(i, container) {
      var height
      var width

      var imgHeight = this.opts.images[i].height
      var imgWidth = this.opts.images[i].width
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

    change: function(delta) {
      this.zoomOut(0)
      this.zoomable()

      var imageCount = this.opts.images.length
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

    arrows: function() {
      if (this.opts.loop) {
        this.$prev.add(this.$next).addClass('active')
      } else if (this.opts.linkImages) {
        // right
        if (this.currentImage == this.opts.images.length - 1) {
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
      this.$description.html(this.opts.images[this.currentImage].title)
    },

    pagination: function() {
      var index = this.currentImage + 1
      var imageCount = this.opts.images.length
      this.$pagination.html(index + ' / ' + imageCount)
    },

    storeImgSize: function(img, i) {
      if (typeof img === 'undefined') {
        return
      }
      if (!this.opts.images[i].height || !this.opts.images[i].width) {
        this.opts.images[i].height = img.height
        this.opts.images[i].width = img.width
      }
    },

    close: function(callback) {
      if (this.isFullScreen) {
        this.exitFullScreen()
        return
      }

      var self = this
      this.currentImage = null
      this.$overlay
        .add(this.$loader)
        .add(this.$wrapper)
        .fadeOut(200, function() {
          self.$container.removeClass('chocolat-open')
          callback && callback()
        })
    },

    destroy: function() {
      $el.removeData('chocolat')
      if (this.initialized) {
        this.initialized = false
        this.currentImage = null

        this.exitFullScreen()

        this.$container.removeClass(transientClasses.join(' '))
        this.$wrapper.remove()

        // Remove event listeners
        this._events.forEach(function(event) {
          event.$target.off(event.type + this.eventNS)
        }, this)
        this._events = null
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

    markup: function() {
      this.$container.addClass('chocolat-open ' + this.opts.className)
      if (this.opts.imageSize == 'cover') {
        this.$container.addClass('chocolat-cover')
      }
      if (this.opts.container !== window) {
        this.$container.addClass('chocolat-in-container')
      }

      this.$wrapper = $('<div/>', {
        class: 'chocolat-wrapper',
        id: 'chocolat-content-' + this.id,
      }).appendTo(this.$container)

      this.$overlay = $('<div/>', {
        class: 'chocolat-overlay',
      }).appendTo(this.$wrapper)

      if (this.opts.showLoader) {
        this.$loader = $('<div/>', {
          class: 'chocolat-loader',
        }).appendTo(this.$wrapper)
      }

      this.$content = $('<div/>', {
        class: 'chocolat-content',
      }).appendTo(this.$wrapper)

      this.$img = $('<img/>', {
        class: 'chocolat-img',
        src: '',
      }).appendTo(this.$content)

      this.$top = $('<div/>', {
        class: 'chocolat-top',
      }).appendTo(this.$wrapper)

      this.$prev = $('<div/>', {
        class: 'chocolat-left',
      }).appendTo(this.$wrapper)

      this.$next = $('<div/>', {
        class: 'chocolat-right',
      }).appendTo(this.$wrapper)

      this.$bottom = $('<div/>', {
        class: 'chocolat-bottom',
      }).appendTo(this.$wrapper)

      this.$close = $('<span/>', {
        class: 'chocolat-close',
      }).appendTo(this.$top)

      if (this.opts.fullScreen !== false) {
        this.$fullscreen = $('<span/>', {
          class: 'chocolat-fullscreen',
        }).appendTo(this.$bottom)
      }

      this.$description = $('<span/>', {
        class: 'chocolat-description',
      }).appendTo(this.$bottom)

      if (this.opts.showPagination) {
        this.$pagination = $('<span/>', {
          class: 'chocolat-pagination',
        }).appendTo(this.$bottom)
      }

      this.$setTitle = $('<span/>', {
        class: 'chocolat-set-title',
        html: this.opts.setTitle,
      }).appendTo(this.$bottom)

      if (this.opts.onMarkup) {
        this.opts.onMarkup(this)
      }
    },

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

    events: function() {
      var self = this
      self._events = []
      function on(target, type, fn) {
        self._events.push({
          $target: $(target).on(type + this.eventNS, fn.bind(self)),
          type: type,
        })
      }

      on(window, 'resize', function() {
        if (this.currentImage == null) return
        var resize = function() {
          var dims = this.fit(this.currentImage, this.$wrapper)
          this.center(dims.width, dims.height, dims.left, dims.top, 0)
          this.zoomable()
        }.bind(this)
        this.debounce(50, resize)
      })

      on(document, 'keydown', function(e) {
        if (this.initialized && this.currentImage !== null) {
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
          if (this.$container.hasClass('chocolat-zoomable')) {
            e.stopPropagation()
            this.zoomIn(e)
          }
        })
      }
    },

    onZoomPan: function(e) {
      if (this.initialZoomState === null) return
      if (this.$img.is(':animated')) return

      var pos = this.$wrapper.offset()
      var height = this.$wrapper.height()
      var width = this.$wrapper.width()

      var currentImage = this.opts.images[this.currentImage]
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

    zoomable: function() {
      var currentImage = this.opts.images[this.currentImage]
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
        this.$container.addClass('chocolat-zoomable')
      } else {
        this.$container.removeClass('chocolat-zoomable')
      }
    },

    zoomIn: function(e) {
      this.initialZoomState = this.opts.imageSize
      this.opts.imageSize = 'native'

      var event = $.Event('mousemove')
      event.pageX = e.pageX
      event.pageY = e.pageY
      event.duration = this.opts.duration
      this.$wrapper.trigger(event)

      this.$container.addClass('chocolat-zoomed')
      var fitting = this.fit(this.currentImage, this.$wrapper)
      return this.center(
        fitting.width,
        fitting.height,
        fitting.left,
        fitting.top,
        this.opts.duration
      )
    },

    zoomOut: function(e, duration) {
      if (this.initialZoomState === null) return
      if (this.currentImage == null) return
      duration = duration || this.opts.duration

      this.opts.imageSize = this.initialZoomState
      this.initialZoomState = null
      this.$img.animate({ margin: 0 }, duration)

      this.$container.removeClass('chocolat-zoomed')
      var fitting = this.fit(this.currentImage, this.$wrapper)
      return this.center(
        fitting.width,
        fitting.height,
        fitting.left,
        fitting.top,
        duration
      )
    },

    setDomContainer: function() {
      // if container == window
      // domContainer = body
      if (this.opts.container === window) {
        this.$container = $('body')
      } else {
        this.$container = $(this.opts.container)
      }
    },

    debounce: function(duration, callback) {
      clearTimeout(this.opts.timerDebounce)
      this.opts.timerDebounce = setTimeout(function() {
        callback()
      }, duration)
    },
  })

  var defaults = {
    container: window, // window or jquery object or jquery selector, or element
    imageSelector: '.chocolat-image',
    className: '',
    imageSize: 'default', // 'default', 'contain', 'cover' or 'native'
    fullScreen: null,
    loop: false,
    linkImages: true,
    duration: 300,
    setTitle: '',
    separator2: '/',
    timer: false,
    timerDebounce: false,
    images: [],
    enableZoom: true,
    showLoader: true,
    showPagination: true,
    imageSource: 'href',
    zoomedPaddingX: function(canvasWidth, imgWidth) {
      return 0
    },
    zoomedPaddingY: function(canvasHeight, imgHeight) {
      return 0
    },
  }

  $.fn.Chocolat = function(opts) {
    return this.each(function() {
      if (!$.data(this, 'chocolat')) {
        var instance = new Chocolat($(this), $.extend(true, {}, defaults, opts))
        $.data(this, 'chocolat', instance)
      }
    })
  }
})
