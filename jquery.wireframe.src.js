(function($, undefined){

  function Wireframe(element, settings){

    var self = this;

    self.defaults = {
      url: null,
      zoom: 10000,
      fps: 37,
      fill: 'rgba(60, 60, 60, 0.1)',
      stroke: 'rgba(0, 0, 0, 1)',
      line: 0.2
    };

    self.options = $.extend({}, self.defaults);
    self.element = element;
    self.init(settings);

    var scrollWheel = function(e){
      var delta = 0;
      if(!e) e = window.event;
      if(e.wheelDelta){
        delta = e.wheelDelta/120;
        if(window.opera) delta = -delta;
      }else if(e.detail) delta = -e.detail/3;
      if(e.preventDefault) e.preventDefault();
      e.returnValue = false;
      delta = (self.options.zoom >= 100) ? delta*(self.options.zoom/60) : delta;
      self.options.zoom = Math.max(self.options.zoom+delta, 1);
    };

    if(window.addEventListener) self.element.get(0).addEventListener('DOMMouseScroll', scrollWheel, false);
    self.element.get(0).onmousewheel = document.onmousewheel = scrollWheel;

    self.element.on('contextmenu.wireframe', function(){ return false; }).on('mousedown.wireframe', function(e){
      if(e.which==1){
        self.rotation.start = { x:e.pageX, y:e.pageY };
        self.rotation.relative = { x:self.rotation.x, y:self.rotation.y };
        self.element.on('mousemove.wireframe', function(e){
          self.rotation.x = self.rotation.relative.x + ((self.rotation.start.x - e.pageX)/self.resolution.w)*Math.PI;
          self.rotation.y = self.rotation.relative.y + ((e.pageY - self.rotation.start.y)/self.resolution.h)*Math.PI;
        });
      }else if(e.which==3){
        self.origin.start = { x:e.pageX, y:e.pageY };
        self.origin.relative = { x:self.origin.x, y:self.origin.y };
        self.element.on('mousemove.wireframe', function(e){
          self.origin.x = self.origin.relative.x - ((self.origin.start.x - e.pageX));
          self.origin.y = self.origin.relative.y - ((self.origin.start.y - e.pageY));
        });
      }
      e.preventDefault();
      return false;
    })

    $(window).on('resize.wireframe', function(e){
      self.resolution = { w: self.element.width(), h: self.element.height() };
      self.origin = { x: self.resolution.w/2, y: self.resolution.h/2 };
      self.element.get(0).width = self.resolution.w;
      self.element.get(0).height = self.resolution.h;
    });

    $(document).on('mouseup.wireframe', function(e){
      self.element.off("mousemove.wireframe");
    });
  }

  Wireframe.prototype.transformPoint = function(p, rot){
    var scale = this.options.zoom/100;
    x = p.x*Math.cos(rot.x) - p.z*Math.sin(rot.x);
    z = p.x*Math.sin(rot.x) + p.z*Math.cos(rot.x);
    y = p.y*Math.cos(rot.y) - z*Math.sin(rot.y);
    px = x*Math.cos(rot.z) - y*Math.sin(rot.z);
    py = x*Math.sin(rot.z) + y*Math.cos(rot.z);
    pz = y*Math.cos(rot.y) - z*Math.sin(rot.y);
    return {
      x:(px*scale)+this.origin.x,
      y:this.origin.y-(py*scale),
      z:(pz*this.options.zoom)
    };
  };

  Wireframe.prototype.drawObject = function(){
    clearTimeout(this.timeline);
    this.canvas.clearRect(0, 0, this.resolution.w, this.resolution.h);
    for(p in this.polygons){
      this.canvas.beginPath();
      point = this.transformPoint(this.polygons[p].vertices[0], this.rotation);
      line = this.canvas.moveTo(point.x, point.y);
      for(v=1;v<this.polygons[p].vertices.length;v++){
        point = this.transformPoint(this.polygons[p].vertices[v], this.rotation);
        this.canvas.lineTo(point.x, point.y);
      }
      this.canvas.closePath();
      if(this.options.stroke) this.canvas.stroke();
      if(this.options.fill) this.canvas.fill();
    }
    this.timeline = setTimeout(this.drawObject.bind(this), 1000/this.options.fps);
  };

  Wireframe.prototype.fetch = function(){
    var self = this;
    $.get(this.options.url, function(data){
      var raw = [];
      data = data.split(/\n/);
      for(i in data){
        if(data[i][0] == '#') continue;
        row = data[i].replace(/([-\s]+)\.([0-9]+)/g, '$1\\0.$2');
        row = $.trim(row.replace(/\\/g, '').replace(/\s+/g, ' '));
        raw.push(row.split(/\s/));
      }
      var vertices = parseInt(raw[1][0]);
      for(i1=vertices+2;i1<raw.length-1;i1++){
        polygon = { vertices:[] };
        for(i2=1;i2<=raw[i1][0];i2++){
          var v = raw[parseInt(raw[i1][i2])+2];
          if(v.length >= 3){
            polygon.vertices.push({ x:parseFloat(v[0]), y:parseFloat(v[1]), z:parseFloat(v[2]) });
          }
        }
        if(polygon.vertices.length >= 3) self.polygons.push(polygon);
      }
      self.drawObject();
    });
  }

  Wireframe.prototype.init = function(settings){
    clearTimeout(this.timeline);
    this.options = $.extend(this.options, settings);
    this.options.zoom = parseInt(settings.zoom);
    this.options.fps = parseInt(settings.fps);
    this.timeline = null;
    this.polygons = [];
    this.rotation = { x:0, y:0, z:0 };
    this.resolution = { w: this.element.width(), h: this.element.height() };
    this.origin = { x: this.resolution.w/2, y: this.resolution.h/2 };
    this.element.get(0).width = this.resolution.w;
    this.element.get(0).height = this.resolution.h;
    this.canvas = this.element.get(0).getContext('2d');
    this.canvas.lineWidth = this.options.line;
    this.canvas.strokeStyle = this.options.stroke;
    this.canvas.fillStyle = this.options.fill;
    this.canvas.shadowBlur = 0;
    this.canvas.lineCap = 'round';
    this.fetch();
  };

  $.fn.wireframe = function(settings){
    return this.each(function(){
      if(!$.data(this, 'wireframe')){
        $.data(this, 'wireframe', new Wireframe($(this), settings));
      }else{
        $.data(this, 'wireframe').init(settings);
      }
    });
  };

})(jQuery);