;(function(factory) {
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

  function Chocolat(element, opts) {
    var self = this

    this.opts = opts
    this.elems = {}
    this.element = element
    this.isFullScreen = false

    if (!this.opts.setTitle && element.data('chocolat-title')) {
      this.opts.setTitle = element.data('chocolat-title')
    }

    this.element.find(this.opts.imageSelector).each(function() {
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

      this.elems.overlay.fadeIn(this.opts.duration)
      this.elems.wrapper.fadeIn(this.opts.duration)
      this.elems.domContainer.addClass('chocolat-open')

      this.opts.timer = setTimeout(function() {
        if (typeof self.elems != 'undefined') {
          $.proxy(self.elems.loader.fadeIn(), self)
        }
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
      fitting = this.fit(i, self.elems.wrapper)

      return this.center(
        fitting.width,
        fitting.height,
        fitting.left,
        fitting.top,
        0
      )
    },

    center: function(width, height, left, top, duration) {
      return this.elems.content
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

      this.elems.loader.stop().fadeOut(300, function() {
        self.elems.img.attr('src', self.opts.images[i].src)
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
        $([this.elems.left[0], this.elems.right[0]]).addClass('active')
      } else if (this.opts.linkImages) {
        // right
        if (this.opts.currentImage == this.opts.lastImage) {
          this.elems.right.removeClass('active')
        } else {
          this.elems.right.addClass('active')
        }
        // left
        if (this.opts.currentImage === 0) {
          this.elems.left.removeClass('active')
        } else {
          this.elems.left.addClass('active')
        }
      } else {
        $([this.elems.left[0], this.elems.right[0]]).removeClass('active')
      }
    },

    description: function() {
      var self = this
      this.elems.description.html(
        self.opts.images[self.opts.currentImage].title
      )
    },

    pagination: function() {
      var self = this
      var last = this.opts.lastImage + 1
      var position = this.opts.currentImage + 1

      this.elems.pagination.html(position + ' ' + self.opts.separator2 + last)
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

      var els = [
        this.elems.overlay[0],
        this.elems.loader[0],
        this.elems.wrapper[0],
      ]
      var self = this
      var def = $.when($(els).fadeOut(200)).done(function() {
        self.elems.domContainer.removeClass('chocolat-open')
      })
      this.opts.currentImage = false

      return def
    },

    destroy: function() {
      this.element.removeData()
      this.element.find(this.opts.imageSelector).off('click.chocolat')

      if (!this.opts.initialized) {
        return
      }
      if (this.isFullScreen) {
        this.exitFullScreen()
      }
      this.opts.currentImage = false
      this.opts.initialized = false
      this.elems.domContainer.removeClass(transientClasses.join(' '))
      this.elems.wrapper.remove()
    },

    getOutMarginW: function() {
      var left = this.elems.left.outerWidth(true)
      var right = this.elems.right.outerWidth(true)
      return left + right
    },

    getOutMarginH: function() {
      return (
        this.elems.top.outerHeight(true) + this.elems.bottom.outerHeight(true)
      )
    },

    markup: function() {
      this.elems.domContainer.addClass('chocolat-open ' + this.opts.className)
      if (this.opts.imageSize == 'cover') {
        this.elems.domContainer.addClass('chocolat-cover')
      }
      if (this.opts.container !== window) {
        this.elems.domContainer.addClass('chocolat-in-container')
      }

      this.elems.wrapper = $('<div/>', {
        class: 'chocolat-wrapper',
        id: 'chocolat-content-' + this.opts.setIndex,
      }).appendTo(this.elems.domContainer)

      this.elems.overlay = $('<div/>', {
        class: 'chocolat-overlay',
      }).appendTo(this.elems.wrapper)

      this.elems.loader = $('<div/>', {
        class: 'chocolat-loader',
      }).appendTo(this.elems.wrapper)

      this.elems.content = $('<div/>', {
        class: 'chocolat-content',
      }).appendTo(this.elems.wrapper)

      this.elems.img = $('<img/>', {
        class: 'chocolat-img',
        src: '',
      }).appendTo(this.elems.content)

      this.elems.top = $('<div/>', {
        class: 'chocolat-top',
      }).appendTo(this.elems.wrapper)

      this.elems.left = $('<div/>', {
        class: 'chocolat-left',
      }).appendTo(this.elems.wrapper)

      this.elems.right = $('<div/>', {
        class: 'chocolat-right',
      }).appendTo(this.elems.wrapper)

      this.elems.bottom = $('<div/>', {
        class: 'chocolat-bottom',
      }).appendTo(this.elems.wrapper)

      this.elems.close = $('<span/>', {
        class: 'chocolat-close',
      }).appendTo(this.elems.top)

      if (this.opts.fullScreen !== false) {
        this.elems.fullscreen = $('<span/>', {
          class: 'chocolat-fullscreen',
        }).appendTo(this.elems.bottom)
      }

      this.elems.description = $('<span/>', {
        class: 'chocolat-description',
      }).appendTo(this.elems.bottom)

      this.elems.pagination = $('<span/>', {
        class: 'chocolat-pagination',
      }).appendTo(this.elems.bottom)

      this.elems.setTitle = $('<span/>', {
        class: 'chocolat-set-title',
        html: this.opts.setTitle,
      }).appendTo(this.elems.bottom)

      this.opts.afterMarkup.call(this)
    },

    openFullScreen: function() {
      if (this.isFullScreen) return
      this.isFullScreen = true

      var wrapper = this.elems.wrapper[0]
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
      // this.elems.wrapper.find('.chocolat-img')
      //     .off('click.chocolat')
      //     .on('click.chocolat', function(e) {
      //         var currentImage = self.opts.images[self.opts.currentImage];
      //         if(currentImage.width > $(self.elems.wrapper).width() || currentImage.height > $(self.elems.wrapper).height() ){
      //             self.toggleZoom(e);
      //         }
      // });

      this.elems.wrapper
        .find('.chocolat-right')
        .off('click.chocolat')
        .on('click.chocolat', function() {
          self.change(+1)
        })

      this.elems.wrapper
        .find('.chocolat-left')
        .off('click.chocolat')
        .on('click.chocolat', function() {
          return self.change(-1)
        })

      $([this.elems.overlay[0], this.elems.close[0]])
        .off('click.chocolat')
        .on('click.chocolat', function() {
          return self.close()
        })

      if (this.opts.fullScreen !== false) {
        this.elems.fullscreen
          .off('click.chocolat')
          .on('click.chocolat', function() {
            if (self.opts.fullscreenOpen) {
              self.exitFullScreen()
              return
            }

            self.openFullScreen()
          })
      }

      if (self.opts.backgroundClose) {
        this.elems.overlay
          .off('click.chocolat')
          .on('click.chocolat', function() {
            return self.close()
          })
      }
      this.elems.wrapper
        .off('click.chocolat')
        .on('click.chocolat', function(e) {
          return self.zoomOut(e)
        })

      this.elems.wrapper
        .find('.chocolat-img')
        .off('click.chocolat')
        .on('click.chocolat', function(e) {
          if (
            self.opts.initialZoomState === null &&
            self.elems.domContainer.hasClass('chocolat-zoomable')
          ) {
            e.stopPropagation()
            return self.zoomIn(e)
          }
        })

      this.elems.wrapper.mousemove(function(e) {
        if (self.opts.initialZoomState === null) {
          return
        }
        if (self.elems.img.is(':animated')) {
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
          $(self.elems.img)
            .stop(false, true)
            .animate(animation, e.duration)
        } else {
          $(self.elems.img)
            .stop(false, true)
            .css(animation)
        }
      })
      $(window).on('resize', function() {
        if (!self.opts.initialized || self.opts.currentImage === false) {
          return
        }
        self.debounce(50, function() {
          var fitting = self.fit(self.opts.currentImage, self.elems.wrapper)
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
      var wrapperWidth = this.elems.wrapper.width()
      var wrapperHeight = this.elems.wrapper.height()

      var isImageZoomable =
        this.opts.enableZoom &&
        (currentImage.width > wrapperWidth ||
          currentImage.height > wrapperHeight)
          ? true
          : false
      var isImageStretched =
        this.elems.img.width() > currentImage.width ||
        this.elems.img.height() > currentImage.height

      if (isImageZoomable && !isImageStretched) {
        this.elems.domContainer.addClass('chocolat-zoomable')
      } else {
        this.elems.domContainer.removeClass('chocolat-zoomable')
      }
    },

    zoomIn: function(e) {
      this.opts.initialZoomState = this.opts.imageSize
      this.opts.imageSize = 'native'

      var event = $.Event('mousemove')
      event.pageX = e.pageX
      event.pageY = e.pageY
      event.duration = this.opts.duration
      this.elems.wrapper.trigger(event)

      this.elems.domContainer.addClass('chocolat-zoomed')
      var fitting = this.fit(this.opts.currentImage, this.elems.wrapper)
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
      this.elems.img.animate({ margin: 0 }, duration)

      this.elems.domContainer.removeClass('chocolat-zoomed')
      var fitting = this.fit(this.opts.currentImage, this.elems.wrapper)
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
        this.elems.domContainer = $('body')
      } else {
        this.elems.domContainer = $(this.opts.container)
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
