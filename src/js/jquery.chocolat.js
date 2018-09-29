﻿;(function(factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('jquery'), window, document)
  } else {
    factory(jQuery, window, document)
  }
})(function($, window, document, undefined) {
  var calls = 0

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

    this.$el = $el
    this.opts = opts
    this.isFullScreen = false

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
      $this.off('click.chocolat').on('click.chocolat', function(e) {
        self.init(i)
        e.preventDefault()
      })
    })

    return this
  }

  $.extend(Chocolat.prototype, {
    init: function(i) {
      if (!this.opts.initialized) {
        this.setDomContainer()
        this.markup()
        this.events()
        this.opts.lastImage = this.opts.images.length - 1
        this.opts.initialized = true
      }

      this.opts.afterInitialize.call(this)

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

      if (this.opts.currentImage === i) {
        return
      }

      this.$overlay.fadeIn(this.opts.duration)
      this.$wrapper.fadeIn(this.opts.duration)
      this.$container.addClass('chocolat-open')

      this.opts.timer = setTimeout(function() {
        $.proxy(self.$loader.fadeIn(), self)
      }, this.opts.duration)

      var deferred = this.preload(i)
        .then(function(imgLoader) {
          return self.place(i, imgLoader)
        })
        .then(function(imgLoader) {
          return self.appear(i)
        })
        .then(function(imgLoader) {
          self.zoomable()
          self.opts.afterImageLoad.call(self)
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

      this.opts.currentImage = i
      this.description()
      this.pagination()
      this.arrows()

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

      this.$loader.stop().fadeOut(300, function() {
        self.$img.attr('src', self.opts.images[i].src)
      })
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

    change: function(signe) {
      this.zoomOut(0)
      this.zoomable()

      var requestedImage = this.opts.currentImage + parseInt(signe)
      if (requestedImage > this.opts.lastImage) {
        if (this.opts.loop) {
          return this.load(0)
        }
      } else if (requestedImage < 0) {
        if (this.opts.loop) {
          return this.load(this.opts.lastImage)
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
        if (this.opts.currentImage == this.opts.lastImage) {
          this.$next.removeClass('active')
        } else {
          this.$next.addClass('active')
        }
        // left
        if (this.opts.currentImage === 0) {
          this.$prev.removeClass('active')
        } else {
          this.$prev.addClass('active')
        }
      } else {
        this.$prev.add(this.$next).removeClass('active')
      }
    },

    description: function() {
      var self = this
      this.$description.html(self.opts.images[self.opts.currentImage].title)
    },

    pagination: function() {
      var self = this
      var last = this.opts.lastImage + 1
      var position = this.opts.currentImage + 1

      this.$pagination.html(position + ' ' + self.opts.separator2 + last)
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

    close: function() {
      if (this.isFullScreen) {
        this.exitFullScreen()
        return
      }

      var els = [this.$overlay[0], this.$loader[0], this.$wrapper[0]]
      var self = this
      var def = $.when($(els).fadeOut(200)).done(function() {
        self.$domContainer.removeClass('chocolat-open')
      })
      this.opts.currentImage = false

      return def
    },

    destroy: function() {
      $el.removeData('chocolat')
      $el.find(this.opts.imageSelector).off('click.chocolat')

      if (!this.opts.initialized) {
        return
      }
      if (this.isFullScreen) {
        this.exitFullScreen()
      }
      this.opts.currentImage = false
      this.opts.initialized = false
      this.$domContainer.removeClass(transientClasses.join(' '))
      this.$wrapper.remove()
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
      this.$domContainer.addClass('chocolat-open ' + this.opts.className)
      if (this.opts.imageSize == 'cover') {
        this.$domContainer.addClass('chocolat-cover')
      }
      if (this.opts.container !== window) {
        this.$domContainer.addClass('chocolat-in-container')
      }

      this.$wrapper = $('<div/>', {
        class: 'chocolat-wrapper',
        id: 'chocolat-content-' + this.opts.setIndex,
      }).appendTo(this.$domContainer)

      this.$overlay = $('<div/>', {
        class: 'chocolat-overlay',
      }).appendTo(this.$wrapper)

      this.$loader = $('<div/>', {
        class: 'chocolat-loader',
      }).appendTo(this.$wrapper)

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

      this.$pagination = $('<span/>', {
        class: 'chocolat-pagination',
      }).appendTo(this.$bottom)

      this.$setTitle = $('<span/>', {
        class: 'chocolat-set-title',
        html: this.opts.setTitle,
      }).appendTo(this.$bottom)

      this.opts.afterMarkup.call(this)
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

      $(document)
        .off('keydown.chocolat')
        .on('keydown.chocolat', function(e) {
          if (self.opts.initialized) {
            if (e.keyCode == 37) {
              self.change(-1)
            } else if (e.keyCode == 39) {
              self.change(1)
            } else if (e.keyCode == 27) {
              self.close()
            }
          }
        })
      // this.$wrapper.find('.chocolat-img')
      //     .off('click.chocolat')
      //     .on('click.chocolat', function(e) {
      //         var currentImage = self.opts.images[self.opts.currentImage];
      //         if(currentImage.width > $(self.$wrapper).width() || currentImage.height > $(self.$wrapper).height() ){
      //             self.toggleZoom(e);
      //         }
      // });

      this.$wrapper
        .find('.chocolat-right')
        .off('click.chocolat')
        .on('click.chocolat', function() {
          self.change(+1)
        })

      this.$wrapper
        .find('.chocolat-left')
        .off('click.chocolat')
        .on('click.chocolat', function() {
          return self.change(-1)
        })

      $([this.$overlay[0], this.$close[0]])
        .off('click.chocolat')
        .on('click.chocolat', function() {
          return self.close()
        })

      if (this.opts.fullScreen !== false) {
        this.$fullscreen.off('click.chocolat').on('click.chocolat', function() {
          if (self.opts.fullscreenOpen) {
            self.exitFullScreen()
            return
          }

          self.openFullScreen()
        })
      }

      if (self.opts.backgroundClose) {
        this.$overlay.off('click.chocolat').on('click.chocolat', function() {
          return self.close()
        })
      }
      this.$wrapper.off('click.chocolat').on('click.chocolat', function(e) {
        return self.zoomOut(e)
      })

      this.$wrapper
        .find('.chocolat-img')
        .off('click.chocolat')
        .on('click.chocolat', function(e) {
          if (
            self.opts.initialZoomState === null &&
            self.$domContainer.hasClass('chocolat-zoomable')
          ) {
            e.stopPropagation()
            return self.zoomIn(e)
          }
        })

      this.$wrapper.mousemove(function(e) {
        if (self.opts.initialZoomState === null) {
          return
        }
        if (self.$img.is(':animated')) {
          return
        }

        var pos = $(this).offset()
        var height = $(this).height()
        var width = $(this).width()

        var currentImage = self.opts.images[self.opts.currentImage]
        var imgWidth = currentImage.width
        var imgHeight = currentImage.height

        var coord = [
          e.pageX - width / 2 - pos.left,
          e.pageY - height / 2 - pos.top,
        ]

        var mvtX = 0
        if (imgWidth > width) {
          var paddingX = self.opts.zoomedPaddingX(imgWidth, width)
          mvtX = coord[0] / (width / 2)
          mvtX = ((imgWidth - width) / 2 + paddingX) * mvtX
        }

        var mvtY = 0
        if (imgHeight > height) {
          var paddingY = self.opts.zoomedPaddingY(imgHeight, height)
          mvtY = coord[1] / (height / 2)
          mvtY = ((imgHeight - height) / 2 + paddingY) * mvtY
        }

        var animation = {
          'margin-left': -mvtX + 'px',
          'margin-top': -mvtY + 'px',
        }
        if (typeof e.duration !== 'undefined') {
          $(self.$img)
            .stop(false, true)
            .animate(animation, e.duration)
        } else {
          $(self.$img)
            .stop(false, true)
            .css(animation)
        }
      })
      $(window).on('resize', function() {
        if (!self.opts.initialized || self.opts.currentImage === false) {
          return
        }
        self.debounce(50, function() {
          var fitting = self.fit(self.opts.currentImage, self.$wrapper)
          self.center(
            fitting.width,
            fitting.height,
            fitting.left,
            fitting.top,
            0
          )
          self.zoomable()
        })
      })
    },

    zoomable: function() {
      var currentImage = this.opts.images[this.opts.currentImage]
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
        this.$domContainer.addClass('chocolat-zoomable')
      } else {
        this.$domContainer.removeClass('chocolat-zoomable')
      }
    },

    zoomIn: function(e) {
      this.opts.initialZoomState = this.opts.imageSize
      this.opts.imageSize = 'native'

      var event = $.Event('mousemove')
      event.pageX = e.pageX
      event.pageY = e.pageY
      event.duration = this.opts.duration
      this.$wrapper.trigger(event)

      this.$domContainer.addClass('chocolat-zoomed')
      var fitting = this.fit(this.opts.currentImage, this.$wrapper)
      return this.center(
        fitting.width,
        fitting.height,
        fitting.left,
        fitting.top,
        this.opts.duration
      )
    },

    zoomOut: function(e, duration) {
      if (
        this.opts.initialZoomState === null ||
        this.opts.currentImage === false
      ) {
        return
      }
      duration = duration || this.opts.duration

      this.opts.imageSize = this.opts.initialZoomState
      this.opts.initialZoomState = null
      this.$img.animate({ margin: 0 }, duration)

      this.$domContainer.removeClass('chocolat-zoomed')
      var fitting = this.fit(this.opts.currentImage, this.$wrapper)
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
    initialZoomState: null,
    fullScreen: null,
    loop: false,
    linkImages: true,
    duration: 300,
    setTitle: '',
    separator2: '/',
    setIndex: 0,
    firstImage: 0,
    lastImage: false,
    currentImage: false,
    initialized: false,
    timer: false,
    timerDebounce: false,
    images: [],
    enableZoom: true,
    imageSource: 'href',
    afterInitialize: function() {},
    afterMarkup: function() {},
    afterImageLoad: function() {},
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
        var instance = new Chocolat(
          $(this),
          $.extend(true, {}, defaults, opts, { setIndex: ++calls })
        )
        $.data(this, 'chocolat', instance)
      }
    })
  }
})
