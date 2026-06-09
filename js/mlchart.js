/* ═══════════════════════════════════════════════════════════════════════════
   MLCHART — toolkit de dataviz unifié (SVG-based, zéro dépendance).
   Extrait de index.html au build 66 pour maintenabilité.
   API exposée sur window.mlChart : bar / line / radar / pie / heatmap /
   histogram / treemap / kpi / sparkline / activityHeatmap / timeline / pips /
   countUp / skeleton / observeReveal / bubble / sankey / sunburst / PAL
═══════════════════════════════════════════════════════════════════════════ */
window.mlChart=(function(){
  // ─── PALETTES ─────────────────────────────────────────────────────────────
  // Palette « lab » : couleurs data-viz contrastées, lisibles en dark mode.
  // Inspirée Observable Plot + Tableau 10. Gardée cohérente avec gold ManaLAB.
  var PAL={
    accent:'#c9a84c',     // gold ManaLAB (accent principal)
    series:[
      '#c9a84c', // gold
      '#4aa0e8', // cyan/bleu
      '#7ec86a', // vert (success)
      '#d9645a', // rouge (danger)
      '#b48cdc', // violet
      '#e88a4a', // orange
      '#7eb3d9', // bleu clair
      '#e8c14a'  // jaune
    ],
    // Mana colors (WUBRG) pour charts MTG-spécifiques
    mtg:{W:'#f5e9c5',U:'#88c8f0',B:'#9088a8',R:'#e07070',G:'#90c890',C:'#c0c0c0'},
    // Échelles
    success:'#7ec86a', warn:'#e8c14a', danger:'#d9645a', info:'#4aa0e8',
    // Neutres
    grid:'rgba(255,255,255,.08)', text:'rgba(255,255,255,.85)',
    textDim:'rgba(255,255,255,.55)', bg:'rgba(255,255,255,.02)'
  };
  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function _el(tag,attrs,parent){
    var ns=(tag==='svg'||tag==='rect'||tag==='circle'||tag==='line'||tag==='path'||tag==='text'||tag==='g'||tag==='polyline'||tag==='polygon'||tag==='defs'||tag==='linearGradient'||tag==='stop')
      ?'http://www.w3.org/2000/svg':'http://www.w3.org/1999/xhtml';
    var e=document.createElementNS(ns,tag);
    if(attrs)Object.keys(attrs).forEach(function(k){
      if(k==='text')e.textContent=attrs[k];
      else if(k==='html')e.innerHTML=attrs[k];
      else e.setAttribute(k,attrs[k]);
    });
    if(parent)parent.appendChild(e);
    return e;
  }
  function _esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function _mount(el){
    if(typeof el==='string')el=document.querySelector(el);
    if(!el)return null;
    el.innerHTML='';
    return el;
  }
  function _dim(el,opts){
    var r=el.getBoundingClientRect();
    return {
      w:(opts&&opts.width)||r.width||320,
      h:(opts&&opts.height)||r.height||180
    };
  }
  function _svg(host,w,h){
    var s=_el('svg',{viewBox:'0 0 '+w+' '+h,width:'100%',height:'100%',style:'display:block;overflow:visible'},host);
    return s;
  }
  function _txt(parent,x,y,t,opts){
    var attrs={x:x,y:y,fill:(opts&&opts.fill)||PAL.text,'font-size':(opts&&opts.size)||11,'font-family':'inherit','text-anchor':(opts&&opts.anchor)||'start','dominant-baseline':(opts&&opts.baseline)||'auto'};
    if(opts&&opts.weight)attrs['font-weight']=opts.weight;
    var el=_el('text',attrs,parent);el.textContent=t;return el;
  }
  function _tooltip(){
    var t=document.getElementById('ml-chart-tt');
    if(!t){
      t=document.createElement('div');t.id='ml-chart-tt';
      t.style.cssText='position:fixed;display:none;pointer-events:none;background:rgba(0,0,0,.92);border:1px solid var(--gold,#c9a84c);border-radius:6px;padding:5px 9px;font-size:.74rem;color:#fff;z-index:99999;max-width:240px;line-height:1.4;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.6)';
      document.body.appendChild(t);
    }
    return t;
  }
  function _ttShow(html,evt){
    var t=_tooltip();t.innerHTML=html;t.style.display='block';
    var x=evt.clientX+12,y=evt.clientY+12;
    if(x+250>window.innerWidth)x=evt.clientX-260;
    if(y+80>window.innerHeight)y=evt.clientY-80;
    t.style.left=x+'px';t.style.top=y+'px';
  }
  function _ttHide(){var t=document.getElementById('ml-chart-tt');if(t)t.style.display='none';}

  // ─── BAR CHART ────────────────────────────────────────────────────────────
  // data: [{label, value, color?}] | opts: {horizontal, max, valueFmt, height}
  function bar(host,data,opts){
    host=_mount(host);if(!host||!data||!data.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var pad={top:8,right:12,bottom:opts.horizontal?12:30,left:opts.horizontal?Math.max(60,Math.min(d.w*0.35,140)):28};
    var iw=d.w-pad.left-pad.right, ih=d.h-pad.top-pad.bottom;
    var max=opts.max||Math.max.apply(null,data.map(function(x){return x.value;})); if(!max)max=1;
    var fmt=opts.valueFmt||function(v){return v;};
    var svg=_svg(host,d.w,d.h);
    var g=_el('g',{transform:'translate('+pad.left+','+pad.top+')'},svg);
    if(opts.horizontal){
      var bH=ih/data.length, gap=Math.max(2,bH*0.18);
      data.forEach(function(it,i){
        var y=i*bH+gap/2;
        var bw=(it.value/max)*iw;
        var col=it.color||PAL.series[i%PAL.series.length];
        var r=_el('rect',{x:0,y:y,width:bw,height:bH-gap,fill:col,rx:3,style:'cursor:pointer;transition:opacity .15s'},g);
        r.addEventListener('mouseenter',function(e){r.style.opacity='.7';_ttShow('<b>'+_esc(it.label)+'</b><br>'+fmt(it.value)+(it.subtitle?'<br><span style="opacity:.7">'+_esc(it.subtitle)+'</span>':''),e);});
        r.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(it.label)+'</b><br>'+fmt(it.value)+(it.subtitle?'<br><span style="opacity:.7">'+_esc(it.subtitle)+'</span>':''),e);});
        r.addEventListener('mouseleave',function(){r.style.opacity='1';_ttHide();});
        // Label à gauche
        _txt(g,-6,y+(bH-gap)/2,it.label,{anchor:'end',baseline:'central',size:10,fill:PAL.text});
        // Valeur à droite si tient
        if(bw>30)_txt(g,bw-4,y+(bH-gap)/2,fmt(it.value),{anchor:'end',baseline:'central',size:10,weight:600,fill:'#000'});
        else _txt(g,bw+4,y+(bH-gap)/2,fmt(it.value),{anchor:'start',baseline:'central',size:10,fill:PAL.text});
      });
    } else {
      var bW=iw/data.length, gapV=Math.max(2,bW*0.18);
      data.forEach(function(it,i){
        var x=i*bW+gapV/2;
        var bh=(it.value/max)*ih;
        var col=it.color||PAL.series[i%PAL.series.length];
        var r=_el('rect',{x:x,y:ih-bh,width:bW-gapV,height:bh,fill:col,rx:3,style:'cursor:pointer;transition:opacity .15s'},g);
        r.addEventListener('mouseenter',function(e){r.style.opacity='.7';_ttShow('<b>'+_esc(it.label)+'</b><br>'+fmt(it.value),e);});
        r.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(it.label)+'</b><br>'+fmt(it.value),e);});
        r.addEventListener('mouseleave',function(){r.style.opacity='1';_ttHide();});
        _txt(g,x+(bW-gapV)/2,ih+14,it.label,{anchor:'middle',size:10,fill:PAL.textDim});
        if(bh>16)_txt(g,x+(bW-gapV)/2,ih-bh+12,fmt(it.value),{anchor:'middle',size:10,weight:600,fill:'#000'});
      });
    }
  }

  // ─── LINE / AREA ──────────────────────────────────────────────────────────
  // series: [{name, values:[{x,y}], color?, area?}] | opts: {height, xLabels, yMin, yMax}
  function line(host,series,opts){
    host=_mount(host);if(!host||!series||!series.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var pad={top:10,right:10,bottom:24,left:34};
    var iw=d.w-pad.left-pad.right, ih=d.h-pad.top-pad.bottom;
    var allY=[],allX=[];
    series.forEach(function(s){s.values.forEach(function(p){allY.push(p.y);allX.push(p.x);});});
    var yMin=opts.yMin!=null?opts.yMin:Math.min(0,Math.min.apply(null,allY));
    var yMax=opts.yMax!=null?opts.yMax:Math.max.apply(null,allY);if(yMax===yMin)yMax=yMin+1;
    var xMin=Math.min.apply(null,allX), xMax=Math.max.apply(null,allX);if(xMin===xMax)xMax=xMin+1;
    var sx=function(x){return ((x-xMin)/(xMax-xMin))*iw;};
    var sy=function(y){return ih-((y-yMin)/(yMax-yMin))*ih;};
    var svg=_svg(host,d.w,d.h);
    var g=_el('g',{transform:'translate('+pad.left+','+pad.top+')'},svg);
    // Grille horizontale
    var nLines=4;
    for(var i=0;i<=nLines;i++){
      var y=ih*(i/nLines);
      _el('line',{x1:0,y1:y,x2:iw,y2:y,stroke:PAL.grid,'stroke-width':.5},g);
      var v=yMax-(yMax-yMin)*(i/nLines);
      _txt(g,-4,y+3,(opts.yFmt?opts.yFmt(v):v.toFixed(0)),{anchor:'end',size:9,fill:PAL.textDim});
    }
    // X labels
    if(opts.xLabels){
      var step=Math.max(1,Math.floor(opts.xLabels.length/6));
      opts.xLabels.forEach(function(l,i){
        if(i%step!==0)return;
        var x=sx(i);
        _txt(g,x,ih+14,l,{anchor:'middle',size:9,fill:PAL.textDim});
      });
    }
    // Séries
    series.forEach(function(s,idx){
      var col=s.color||PAL.series[idx%PAL.series.length];
      var pts=s.values.map(function(p){return sx(p.x)+','+sy(p.y);}).join(' ');
      if(s.area){
        var areaPts='0,'+ih+' '+pts+' '+sx(xMax)+','+ih;
        _el('polygon',{points:areaPts,fill:col,'fill-opacity':.15},g);
      }
      _el('polyline',{points:pts,fill:'none',stroke:col,'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'},g);
      // Points + tooltip
      s.values.forEach(function(p,pi){
        var cx=sx(p.x),cy=sy(p.y);
        var c=_el('circle',{cx:cx,cy:cy,r:3,fill:col,stroke:'#0a0805','stroke-width':1,style:'cursor:pointer'},g);
        c.addEventListener('mouseenter',function(e){_ttShow('<b>'+_esc(s.name)+'</b><br>'+(opts.xLabels?_esc(opts.xLabels[p.x]||p.x):'x='+p.x)+'<br>'+(opts.yFmt?opts.yFmt(p.y):p.y),e);c.setAttribute('r',5);});
        c.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(s.name)+'</b><br>'+(opts.xLabels?_esc(opts.xLabels[p.x]||p.x):'x='+p.x)+'<br>'+(opts.yFmt?opts.yFmt(p.y):p.y),e);});
        c.addEventListener('mouseleave',function(){_ttHide();c.setAttribute('r',3);});
      });
    });
  }

  // ─── RADAR ────────────────────────────────────────────────────────────────
  // axes: ['Ramp','Draw',...] | series: [{name, values:[0..1], color?}]
  function radar(host,axes,series,opts){
    host=_mount(host);if(!host||!axes||!axes.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var cx=d.w/2, cy=d.h/2, R=Math.min(d.w,d.h)/2-30;
    var svg=_svg(host,d.w,d.h);
    var n=axes.length;
    // Grille
    [.25,.5,.75,1].forEach(function(lvl){
      var pts=axes.map(function(_,i){
        var ang=-Math.PI/2+(2*Math.PI*i/n);
        return (cx+Math.cos(ang)*R*lvl)+','+(cy+Math.sin(ang)*R*lvl);
      }).join(' ');
      _el('polygon',{points:pts,fill:'none',stroke:PAL.grid,'stroke-width':.5},svg);
    });
    // Axes
    axes.forEach(function(_,i){
      var ang=-Math.PI/2+(2*Math.PI*i/n);
      _el('line',{x1:cx,y1:cy,x2:cx+Math.cos(ang)*R,y2:cy+Math.sin(ang)*R,stroke:PAL.grid,'stroke-width':.5},svg);
    });
    // Labels
    axes.forEach(function(a,i){
      var ang=-Math.PI/2+(2*Math.PI*i/n);
      var lx=cx+Math.cos(ang)*(R+14), ly=cy+Math.sin(ang)*(R+14);
      _txt(svg,lx,ly,a,{anchor:Math.abs(Math.cos(ang))<.3?'middle':(Math.cos(ang)>0?'start':'end'),baseline:'central',size:10,fill:PAL.text,weight:500});
    });
    // Series
    series.forEach(function(s,si){
      var col=s.color||PAL.series[si%PAL.series.length];
      var pts=s.values.map(function(v,i){
        var ang=-Math.PI/2+(2*Math.PI*i/n);
        var r=Math.max(0,Math.min(1,v))*R;
        return (cx+Math.cos(ang)*r)+','+(cy+Math.sin(ang)*r);
      }).join(' ');
      _el('polygon',{points:pts,fill:col,'fill-opacity':.18,stroke:col,'stroke-width':2,'stroke-linejoin':'round'},svg);
      s.values.forEach(function(v,i){
        var ang=-Math.PI/2+(2*Math.PI*i/n);
        var r=Math.max(0,Math.min(1,v))*R;
        var px=cx+Math.cos(ang)*r, py=cy+Math.sin(ang)*r;
        var c=_el('circle',{cx:px,cy:py,r:3,fill:col,style:'cursor:pointer'},svg);
        c.addEventListener('mouseenter',function(e){_ttShow('<b>'+_esc(axes[i])+'</b><br>'+_esc(s.name)+': '+(opts.fmt?opts.fmt(v):(v*100).toFixed(0)+'%'),e);});
        c.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(axes[i])+'</b><br>'+_esc(s.name)+': '+(opts.fmt?opts.fmt(v):(v*100).toFixed(0)+'%'),e);});
        c.addEventListener('mouseleave',function(){_ttHide();});
      });
    });
  }

  // ─── PIE / DONUT ──────────────────────────────────────────────────────────
  function pie(host,slices,opts){
    host=_mount(host);if(!host||!slices||!slices.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var cx=d.w/2, cy=d.h/2, R=Math.min(d.w,d.h)/2-6;
    var rIn=opts.donut?R*0.55:0;
    var svg=_svg(host,d.w,d.h);
    var total=slices.reduce(function(s,x){return s+x.value;},0);if(!total)return;
    var ang=-Math.PI/2;
    slices.forEach(function(sl,i){
      var pct=sl.value/total;
      var sw=pct*Math.PI*2;
      var col=sl.color||PAL.series[i%PAL.series.length];
      var ax=cx+Math.cos(ang)*R, ay=cy+Math.sin(ang)*R;
      var bx=cx+Math.cos(ang+sw)*R, by=cy+Math.sin(ang+sw)*R;
      var large=sw>Math.PI?1:0;
      var path='M '+cx+','+cy+' L '+ax+','+ay+' A '+R+','+R+' 0 '+large+' 1 '+bx+','+by+' Z';
      if(rIn>0){
        var ax2=cx+Math.cos(ang)*rIn, ay2=cy+Math.sin(ang)*rIn;
        var bx2=cx+Math.cos(ang+sw)*rIn, by2=cy+Math.sin(ang+sw)*rIn;
        path='M '+ax+','+ay+' A '+R+','+R+' 0 '+large+' 1 '+bx+','+by+' L '+bx2+','+by2+' A '+rIn+','+rIn+' 0 '+large+' 0 '+ax2+','+ay2+' Z';
      }
      var p=_el('path',{d:path,fill:col,stroke:'#0a0805','stroke-width':1.5,style:'cursor:pointer;transition:opacity .15s'},svg);
      p.addEventListener('mouseenter',function(e){p.style.opacity='.7';_ttShow('<b>'+_esc(sl.label)+'</b><br>'+sl.value+' ('+(pct*100).toFixed(1)+'%)',e);});
      p.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(sl.label)+'</b><br>'+sl.value+' ('+(pct*100).toFixed(1)+'%)',e);});
      p.addEventListener('mouseleave',function(){p.style.opacity='1';_ttHide();});
      ang+=sw;
    });
    if(opts.donut&&opts.centerText){
      _txt(svg,cx,cy-4,opts.centerText,{anchor:'middle',baseline:'central',size:14,weight:700,fill:PAL.text});
      if(opts.centerSubtitle)_txt(svg,cx,cy+12,opts.centerSubtitle,{anchor:'middle',baseline:'central',size:9,fill:PAL.textDim});
    }
  }

  // ─── HEATMAP ──────────────────────────────────────────────────────────────
  // matrix: [[v,v,v],[v,v,v]] | opts: {rowLabels, colLabels, scale:[low,high], colorLow, colorHigh}
  function heatmap(host,matrix,opts){
    host=_mount(host);if(!host||!matrix||!matrix.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var pad={top:opts.colLabels?22:6,right:8,bottom:6,left:opts.rowLabels?Math.max(60,Math.min(d.w*0.25,120)):6};
    var iw=d.w-pad.left-pad.right, ih=d.h-pad.top-pad.bottom;
    var rows=matrix.length, cols=matrix[0].length;
    var cw=iw/cols, ch=ih/rows;
    var flat=[];matrix.forEach(function(r){r.forEach(function(v){flat.push(v);});});
    var lo=opts.scale?opts.scale[0]:Math.min.apply(null,flat);
    var hi=opts.scale?opts.scale[1]:Math.max.apply(null,flat);
    if(lo===hi)hi=lo+1;
    var cLo=opts.colorLow||'#1a1410', cHi=opts.colorHigh||PAL.accent;
    var svg=_svg(host,d.w,d.h);
    var g=_el('g',{transform:'translate('+pad.left+','+pad.top+')'},svg);
    function lerp(t){
      var p=parseInt(cLo.slice(1),16), q=parseInt(cHi.slice(1),16);
      var pr=(p>>16)&255, pg=(p>>8)&255, pb=p&255;
      var qr=(q>>16)&255, qg=(q>>8)&255, qb=q&255;
      var r=Math.round(pr+(qr-pr)*t), gg=Math.round(pg+(qg-pg)*t), b=Math.round(pb+(qb-pb)*t);
      return 'rgb('+r+','+gg+','+b+')';
    }
    matrix.forEach(function(row,ri){
      row.forEach(function(v,ci){
        var t=(v-lo)/(hi-lo);t=Math.max(0,Math.min(1,t));
        var x=ci*cw, y=ri*ch;
        var col=lerp(t);
        var r=_el('rect',{x:x+1,y:y+1,width:cw-2,height:ch-2,fill:col,rx:2,style:'cursor:pointer;transition:opacity .15s'},g);
        var lbl=(opts.colLabels?opts.colLabels[ci]:'col '+ci)+' × '+(opts.rowLabels?opts.rowLabels[ri]:'row '+ri);
        r.addEventListener('mouseenter',function(e){r.style.opacity='.75';_ttShow('<b>'+_esc(lbl)+'</b><br>'+(opts.fmt?opts.fmt(v):v),e);});
        r.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(lbl)+'</b><br>'+(opts.fmt?opts.fmt(v):v),e);});
        r.addEventListener('mouseleave',function(){r.style.opacity='1';_ttHide();});
        // Valeur dans la cellule si assez grande
        if(cw>28&&ch>18&&v>0){
          _txt(g,x+cw/2,y+ch/2,opts.fmt?opts.fmt(v):v,{anchor:'middle',baseline:'central',size:10,weight:600,fill:t>0.5?'#0a0805':PAL.text});
        }
      });
    });
    if(opts.colLabels){
      opts.colLabels.forEach(function(l,i){
        _txt(g,i*cw+cw/2,-6,l,{anchor:'middle',size:10,fill:PAL.textDim});
      });
    }
    if(opts.rowLabels){
      opts.rowLabels.forEach(function(l,i){
        _txt(g,-6,i*ch+ch/2,l,{anchor:'end',baseline:'central',size:10,fill:PAL.textDim});
      });
    }
  }

  // ─── HISTOGRAM (alias bar pour bins numériques) ───────────────────────────
  function histogram(host,bins,opts){
    return bar(host,bins.map(function(b){return {label:b.label||b.x,value:b.count,color:b.color};}),opts);
  }

  // ─── TREEMAP (squarified, simple) ─────────────────────────────────────────
  // items: [{label, value, color?}] | opts: {height}
  function treemap(host,items,opts){
    host=_mount(host);if(!host||!items||!items.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var total=items.reduce(function(s,x){return s+x.value;},0);
    var area=d.w*d.h;
    var scaled=items.slice().sort(function(a,b){return b.value-a.value;}).map(function(x,i){
      return {label:x.label,value:x.value,color:x.color||PAL.series[i%PAL.series.length],ratio:x.value/total};
    });
    var svg=_svg(host,d.w,d.h);
    // Squarified simple : rows alternées h/v
    function layout(items,x,y,w,h){
      if(!items.length)return;
      if(items.length===1){_drawRect(items[0],x,y,w,h);return;}
      // Split en 2 groupes ~ équilibrés en valeur
      var sum=items.reduce(function(s,x){return s+x.value;},0);
      var acc=0,split=0;
      for(var i=0;i<items.length;i++){
        acc+=items[i].value;
        if(acc>=sum/2){split=i+1;break;}
      }
      if(split===0||split>=items.length)split=Math.ceil(items.length/2);
      var firstGroup=items.slice(0,split), restGroup=items.slice(split);
      var firstSum=firstGroup.reduce(function(s,x){return s+x.value;},0);
      var firstFrac=firstSum/sum;
      if(w>h){
        var firstW=w*firstFrac;
        layout(firstGroup,x,y,firstW,h);
        layout(restGroup,x+firstW,y,w-firstW,h);
      }else{
        var firstH=h*firstFrac;
        layout(firstGroup,x,y,w,firstH);
        layout(restGroup,x,y+firstH,w,h-firstH);
      }
    }
    function _drawRect(it,x,y,w,h){
      var g=_el('g',{},svg);
      var r=_el('rect',{x:x+1,y:y+1,width:Math.max(0,w-2),height:Math.max(0,h-2),fill:it.color,rx:3,style:'cursor:pointer;transition:opacity .15s'},g);
      r.addEventListener('mouseenter',function(e){r.style.opacity='.75';_ttShow('<b>'+_esc(it.label)+'</b><br>'+it.value+' ('+(it.ratio*100).toFixed(1)+'%)',e);});
      r.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(it.label)+'</b><br>'+it.value+' ('+(it.ratio*100).toFixed(1)+'%)',e);});
      r.addEventListener('mouseleave',function(){r.style.opacity='1';_ttHide();});
      if(w>50&&h>22){
        _txt(g,x+8,y+16,it.label,{size:11,weight:600,fill:'#0a0805'});
        if(h>36)_txt(g,x+8,y+30,it.value+'',{size:10,fill:'rgba(0,0,0,.7)'});
      }
    }
    layout(scaled,0,0,d.w,d.h);
  }

  // ─── KPI CARD ─────────────────────────────────────────────────────────────
  // value/label/sub/icon/trend (+N% en delta optionnel)/sparkline values
  function kpi(host,opts){
    host=_mount(host);if(!host)return;
    opts=opts||{};
    var col=opts.color||PAL.accent;
    var html='<div style="padding:14px 16px;background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.15));border:1px solid '+col+';border-radius:11px;min-height:80px;position:relative;overflow:hidden">'
      +(opts.icon?'<div style="position:absolute;top:8px;right:10px;font-size:1.2rem;opacity:.4">'+opts.icon+'</div>':'')
      +'<div style="font-size:.66rem;color:'+PAL.textDim+';letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:4px">'+_esc(opts.label||'')+'</div>'
      +'<div style="font-size:1.7rem;color:'+col+';font-weight:700;line-height:1.1">'+_esc(opts.value||'')+(opts.unit?'<span style="font-size:.7em;opacity:.7;margin-left:3px">'+opts.unit+'</span>':'')+'</div>'
      +(opts.sub?'<div style="font-size:.7rem;color:'+PAL.textDim+';margin-top:3px">'+opts.sub+'</div>':'')
      +(opts.trend!=null?'<div style="position:absolute;bottom:8px;right:10px;font-size:.7rem;color:'+(opts.trend>0?PAL.success:opts.trend<0?PAL.danger:PAL.textDim)+';font-weight:600">'+(opts.trend>0?'▲':opts.trend<0?'▼':'—')+' '+Math.abs(opts.trend).toFixed(opts.trend%1?1:0)+(opts.trendUnit||'%')+'</div>':'')
      +(opts.spark?'<div id="ml-kpi-spark-'+Date.now()+Math.random().toString(36).slice(2,6)+'" style="position:absolute;bottom:0;left:0;right:0;height:24px;opacity:.5"></div>':'')
      +'</div>';
    host.innerHTML=html;
    if(opts.spark&&opts.spark.length){
      var sparkEl=host.querySelector('div[id^=ml-kpi-spark-]');
      sparkline(sparkEl,opts.spark,{color:col,height:24});
    }
  }

  // ─── SPARKLINE ────────────────────────────────────────────────────────────
  function sparkline(host,values,opts){
    host=_mount(host);if(!host||!values||!values.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var min=Math.min.apply(null,values), max=Math.max.apply(null,values);if(min===max)max=min+1;
    var sx=function(i){return (i/(values.length-1||1))*d.w;};
    var sy=function(v){return d.h-((v-min)/(max-min))*(d.h-2)-1;};
    var svg=_svg(host,d.w,d.h);
    var pts=values.map(function(v,i){return sx(i)+','+sy(v);}).join(' ');
    var col=opts.color||PAL.accent;
    if(opts.area!==false){
      var areaPts='0,'+d.h+' '+pts+' '+d.w+','+d.h;
      _el('polygon',{points:areaPts,fill:col,'fill-opacity':.2},svg);
    }
    _el('polyline',{points:pts,fill:'none',stroke:col,'stroke-width':1.5},svg);
  }

  // ─── ACTIVITY HEATMAP (style GitHub commit graph) ─────────────────────────
  // dailyMap: {YYYY-MM-DD: count} | opts: {weeks, height, showMonths}
  function activityHeatmap(host,dailyMap,opts){
    host=_mount(host);if(!host)return;
    opts=opts||{};
    var weeks=opts.weeks||13;
    var showMonths=opts.showMonths||(weeks>=20);
    var d=_dim(host,opts);
    var cellGap=2;
    var topPad=showMonths?14:0;
    var cw=Math.floor((d.w-cellGap)/weeks)-cellGap;
    var ch=Math.floor((d.h-cellGap-topPad)/7)-cellGap;
    if(cw<4)cw=4;if(ch<4)ch=4;
    var totalW=(cw+cellGap)*weeks, totalH=(ch+cellGap)*7+topPad;
    var svg=_svg(host,totalW,totalH);
    var today=new Date();
    var max=Math.max.apply(null,Object.values(dailyMap||{}).concat([1]));
    var dow=(today.getDay()+6)%7;
    var lastMonthDrawn=null;
    for(var w=weeks-1;w>=0;w--){
      var weekStart=new Date(today);
      weekStart.setDate(today.getDate()-(weeks-1-w)*7-dow);
      // Mois label en haut (1er du mois ou changement)
      if(showMonths){
        var m=weekStart.getMonth();
        if(m!==lastMonthDrawn&&weekStart.getDate()<=7){
          var monthAbbr=['jan','fév','mar','avr','mai','jun','jui','aoû','sep','oct','nov','déc'][m];
          _txt(svg,w*(cw+cellGap),10,monthAbbr,{size:9,fill:PAL.textDim});
          lastMonthDrawn=m;
        }
      }
      for(var dd=0;dd<7;dd++){
        var date=new Date(weekStart);date.setDate(weekStart.getDate()+dd);
        if(date>today)continue;
        var key=date.toISOString().slice(0,10);
        var n=dailyMap&&dailyMap[key]||0;
        var t=n/max;
        var col=n===0?'rgba(255,255,255,.04)':'rgba('+Math.round(201*(1-t)+201*t)+','+Math.round(168*(1-t)+168*t)+','+Math.round(76*(1-t)+76*t)+','+(0.15+0.85*t)+')';
        var r=_el('rect',{x:w*(cw+cellGap),y:topPad+dd*(ch+cellGap),width:cw,height:ch,fill:col,rx:1.5,style:'cursor:pointer'},svg);
        r.addEventListener('mouseenter',function(dt,nn){return function(e){_ttShow('<b>'+dt.toLocaleDateString('fr-FR')+'</b><br>'+nn+' action'+(nn>1?'s':''),e);};}(date,n));
        r.addEventListener('mousemove',function(dt,nn){return function(e){_ttShow('<b>'+dt.toLocaleDateString('fr-FR')+'</b><br>'+nn+' action'+(nn>1?'s':''),e);};}(date,n));
        r.addEventListener('mouseleave',function(){_ttHide();});
      }
    }
  }

  // ─── TIMELINE ──────────────────────────────────────────────────────────────
  // events: [{t:seconds, type, msg, value?}] | opts: {height}
  function timeline(host,events,opts){
    host=_mount(host);if(!host||!events||!events.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var pad={top:24,right:14,bottom:24,left:14};
    var iw=d.w-pad.left-pad.right, ih=d.h-pad.top-pad.bottom;
    var tMax=Math.max.apply(null,events.map(function(e){return e.t;}));
    if(!tMax)tMax=1;
    var svg=_svg(host,d.w,d.h);
    // Axe
    _el('line',{x1:pad.left,y1:pad.top+ih/2,x2:d.w-pad.right,y2:pad.top+ih/2,stroke:PAL.grid,'stroke-width':1},svg);
    var typeCol={life:'#d9645a',roll:'#e8c14a',toss:'#e8c14a',mulligan:'#b48cdc',sideboard:'#4aa0e8',start:'#7ec86a',end:'#7ec86a',reset:PAL.textDim,danger:'#d9645a'};
    events.forEach(function(ev){
      var x=pad.left+(ev.t/tMax)*iw;
      var y=pad.top+ih/2;
      var col=typeCol[ev.type]||PAL.accent;
      var c=_el('circle',{cx:x,cy:y,r:4,fill:col,stroke:'#0a0805','stroke-width':1.5,style:'cursor:pointer'},svg);
      c.addEventListener('mouseenter',function(e){_ttShow('<b>'+Math.round(ev.t)+'s</b><br>'+_esc(ev.msg||ev.type),e);c.setAttribute('r',6);});
      c.addEventListener('mousemove',function(e){_ttShow('<b>'+Math.round(ev.t)+'s</b><br>'+_esc(ev.msg||ev.type),e);});
      c.addEventListener('mouseleave',function(){_ttHide();c.setAttribute('r',4);});
    });
    // Labels temps
    _txt(svg,pad.left,d.h-6,'0s',{size:9,fill:PAL.textDim});
    _txt(svg,d.w-pad.right,d.h-6,Math.round(tMax)+'s',{anchor:'end',size:9,fill:PAL.textDim});
  }

  // ─── PIPS (mana symbols par couleur) ──────────────────────────────────────
  // pipCount: {W:5, U:0, B:12, R:0, G:8}
  function pips(host,pipCount,opts){
    host=_mount(host);if(!host)return;
    var data=['W','U','B','R','G'].filter(function(c){return pipCount[c];}).map(function(c){
      return {label:c,value:pipCount[c],color:PAL.mtg[c]};
    });
    return bar(host,data,Object.assign({horizontal:true},opts||{}));
  }

  // ─── COUNT-UP ANIMATION ──────────────────────────────────────────────────
  // Anime un nombre de 0 (ou from) vers target avec easing easeOutQuart sur dur ms.
  // Détecte si target est un float pour formater avec décimales.
  // Respecte prefers-reduced-motion (skip anim, set direct).
  function countUp(el,target,opts){
    if(typeof el==='string')el=document.querySelector(el);
    if(!el)return;
    opts=opts||{};
    var from=opts.from!=null?opts.from:0;
    var dur=opts.duration||900;
    var fmt=opts.fmt||function(v){
      return target%1!==0?v.toFixed(1):Math.round(v).toLocaleString('fr-FR');
    };
    var suffix=opts.suffix||'';
    var prefix=opts.prefix||'';
    // Respect prefers-reduced-motion
    try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      el.textContent=prefix+fmt(target)+suffix;return;
    }}catch(_){}
    var t0=performance.now();
    function tick(now){
      var p=Math.min(1,(now-t0)/dur);
      var ease=1-Math.pow(1-p,4); // easeOutQuart
      var v=from+(target-from)*ease;
      el.textContent=prefix+fmt(v)+suffix;
      if(p<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  // ─── SKELETON LOADER ─────────────────────────────────────────────────────
  // Affiche un placeholder shimmer pendant chargement async (style LinkedIn).
  // Types : 'kpi' / 'chart' / 'card' / 'text'. Hauteur configurable.
  function skeleton(host,type,opts){
    if(typeof host==='string')host=document.querySelector(host);
    if(!host)return;
    opts=opts||{};
    var presets={
      kpi:{h:88,bars:[[60,12,8],[80,28,8],[120,10,10]]}, // label / value / sub
      chart:{h:opts.height||180,bars:[[100,opts.height||180,0]]},
      card:{h:140,bars:[[40,40,8],[80,14,8],[60,10,4]]},
      text:{h:18,bars:[[100,18,0]]}
    };
    var p=presets[type]||presets.text;
    var h='<div class="ml-skel" style="display:flex;flex-direction:column;gap:6px;padding:'+(type==='kpi'?'14px 16px':'12px')+';background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.15));border:1px solid var(--bd2,#3a2e1a);border-radius:11px">';
    p.bars.forEach(function(b){
      h+='<div class="ml-skel-bar" style="width:'+b[0]+'%;height:'+b[1]+'px;border-radius:4px;background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.10) 50%,rgba(255,255,255,.04) 100%);background-size:200% 100%;animation:ml-shimmer 1.4s ease-in-out infinite"></div>';
    });
    h+='</div>';
    host.innerHTML=h;
  }
  // ─── INTERSECTION OBSERVER : reveal au scroll ────────────────────────────
  // Charts qui entrent dans le viewport reçoivent class 'ml-revealed' pour
  // déclencher fade-in + slide-up CSS. Réduit le « tout apparaît d'un coup »
  // au scroll initial.
  var _revealObs=null;
  function _setupReveal(){
    if(_revealObs||!('IntersectionObserver'in window))return;
    _revealObs=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add('ml-revealed');_revealObs.unobserve(e.target);}
      });
    },{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  }
  function observeReveal(el){
    if(typeof el==='string')el=document.querySelector(el);
    if(!el)return;
    _setupReveal();
    el.classList.add('ml-reveal');
    if(_revealObs)_revealObs.observe(el);
  }

  // ─── KPI v2 — countUp intégré + delta + sparkline + onClick ──────────────
  // Override de la fonction kpi originale (préservée si besoin via kpi.raw)
  var _kpiOriginal=kpi;
  function kpiV2(host,opts){
    host=_mount(host);if(!host)return;
    opts=opts||{};
    var col=opts.color||PAL.accent;
    var hasNumValue=typeof opts.value==='number';
    var deltaHtml='';
    if(opts.delta!=null){
      var dv=opts.delta;
      var dCol=dv>0?PAL.success:dv<0?PAL.danger:PAL.textDim;
      var dArrow=dv>0?'▲':dv<0?'▼':'—';
      deltaHtml='<div class="ml-kpi-delta" style="position:absolute;bottom:8px;right:10px;font-size:.7rem;color:'+dCol+';font-weight:600">'+dArrow+' '+Math.abs(dv).toFixed(dv%1?1:0)+(opts.deltaUnit||'%')+'</div>';
    }else if(opts.trend!=null){
      var t=opts.trend;
      var tCol=t>0?PAL.success:t<0?PAL.danger:PAL.textDim;
      deltaHtml='<div class="ml-kpi-delta" style="position:absolute;bottom:8px;right:10px;font-size:.7rem;color:'+tCol+';font-weight:600">'+(t>0?'▲':t<0?'▼':'—')+' '+Math.abs(t).toFixed(t%1?1:0)+(opts.trendUnit||'%')+'</div>';
    }
    var clickAttr=typeof opts.onClick==='function'?' style="cursor:pointer" data-clickable="1"':'';
    var uid='kvg-'+Math.random().toString(36).slice(2,8);
    var sparkH=opts.spark&&opts.spark.length?24:0;
    var html='<div class="ml-kpi-card ml-reveal" '+clickAttr+' style="padding:14px 16px;background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.15));border:1px solid '+col+';border-radius:11px;min-height:80px;position:relative;overflow:hidden;transition:transform .2s ease-out,box-shadow .2s ease-out,border-color .15s">'
      +(opts.icon?'<div class="ml-kpi-ico" style="position:absolute;top:8px;right:10px;font-size:1.2rem;opacity:.4;transition:opacity .2s">'+opts.icon+'</div>':'')
      +'<div style="font-size:.66rem;color:'+PAL.textDim+';letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:4px">'+_esc(opts.label||'')+'</div>'
      +'<div class="ml-kpi-val" id="'+uid+'" style="font-size:1.7rem;color:'+col+';font-weight:700;line-height:1.1">'+(hasNumValue?'0':_esc(opts.value||''))+(opts.unit?'<span style="font-size:.7em;opacity:.7;margin-left:3px">'+opts.unit+'</span>':'')+'</div>'
      +(opts.sub?'<div style="font-size:.7rem;color:'+PAL.textDim+';margin-top:3px;'+(deltaHtml?'padding-right:55px':'')+'">'+opts.sub+'</div>':'')
      +deltaHtml
      +(opts.spark?'<div id="'+uid+'-spark" style="position:absolute;bottom:0;left:0;right:0;height:'+sparkH+'px;opacity:.55"></div>':'')
      +'</div>';
    host.innerHTML=html;
    // Animation count-up sur nombre
    if(hasNumValue){
      var vEl=document.getElementById(uid);
      if(vEl){
        var unitHtml=opts.unit?'<span style="font-size:.7em;opacity:.7;margin-left:3px">'+opts.unit+'</span>':'';
        // On extrait le node texte pour animer juste le chiffre (préserve le span unit)
        vEl.innerHTML='<span class="ml-kpi-num">0</span>'+unitHtml;
        var numEl=vEl.querySelector('.ml-kpi-num');
        if(numEl)countUp(numEl,opts.value,{duration:1100,fmt:opts.fmt});
      }
    }
    // Sparkline
    if(opts.spark&&opts.spark.length){
      var sparkEl=document.getElementById(uid+'-spark');
      if(sparkEl)sparkline(sparkEl,opts.spark,{color:col,height:sparkH});
    }
    // Hover lift
    var card=host.querySelector('.ml-kpi-card');
    if(card){
      card.addEventListener('mouseenter',function(){card.style.transform='translateY(-3px)';card.style.boxShadow='0 8px 22px rgba(0,0,0,.4),0 0 0 1px '+col;});
      card.addEventListener('mouseleave',function(){card.style.transform='';card.style.boxShadow='';});
    }
    // onClick
    if(typeof opts.onClick==='function'&&card){
      card.addEventListener('click',function(e){opts.onClick(e,opts);});
    }
    // Reveal observer
    observeReveal(host);
  }
  // Remplace kpi par la v2 (l'API ancienne reste compatible : tous les opts existants sont supportés)
  kpi=kpiV2;
  kpi.raw=_kpiOriginal;

  // ─── BUBBLE CHART ────────────────────────────────────────────────────────
  // points: [{x, y, r, label, color}] | opts: {xLabel, yLabel, xMin, xMax, yMin, yMax}
  function bubble(host,points,opts){
    host=_mount(host);if(!host||!points||!points.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var pad={top:16,right:14,bottom:30,left:38};
    var iw=d.w-pad.left-pad.right, ih=d.h-pad.top-pad.bottom;
    var xs=points.map(function(p){return p.x;}),ys=points.map(function(p){return p.y;}),rs=points.map(function(p){return p.r||1;});
    var xMin=opts.xMin!=null?opts.xMin:Math.min.apply(null,xs);
    var xMax=opts.xMax!=null?opts.xMax:Math.max.apply(null,xs);if(xMin===xMax)xMax=xMin+1;
    var yMin=opts.yMin!=null?opts.yMin:Math.min.apply(null,ys);
    var yMax=opts.yMax!=null?opts.yMax:Math.max.apply(null,ys);if(yMin===yMax)yMax=yMin+1;
    var rMax=Math.max.apply(null,rs);
    var sx=function(x){return ((x-xMin)/(xMax-xMin))*iw;};
    var sy=function(y){return ih-((y-yMin)/(yMax-yMin))*ih;};
    var sr=function(r){return 3+Math.sqrt(r/rMax)*22;};
    var svg=_svg(host,d.w,d.h);
    var g=_el('g',{transform:'translate('+pad.left+','+pad.top+')'},svg);
    // Grille
    for(var i=0;i<=4;i++){
      var gy=ih*(i/4);
      _el('line',{x1:0,y1:gy,x2:iw,y2:gy,stroke:PAL.grid,'stroke-width':.5},g);
      _txt(g,-4,gy+3,(yMax-(yMax-yMin)*(i/4)).toFixed(opts.yPrecision||0),{anchor:'end',size:9,fill:PAL.textDim});
    }
    for(var j=0;j<=4;j++){
      var gx=iw*(j/4);
      _el('line',{x1:gx,y1:0,x2:gx,y2:ih,stroke:PAL.grid,'stroke-width':.5},g);
      _txt(g,gx,ih+14,(xMin+(xMax-xMin)*(j/4)).toFixed(opts.xPrecision||0),{anchor:'middle',size:9,fill:PAL.textDim});
    }
    if(opts.xLabel)_txt(g,iw/2,ih+26,opts.xLabel,{anchor:'middle',size:10,fill:PAL.textDim});
    if(opts.yLabel){
      var ylbl=_el('text',{x:-pad.left+8,y:ih/2,fill:PAL.textDim,'font-size':10,'text-anchor':'middle',transform:'rotate(-90 '+(-pad.left+8)+' '+(ih/2)+')'},g);
      ylbl.textContent=opts.yLabel;
    }
    // Bubbles
    points.forEach(function(p,i){
      var cx=sx(p.x),cy=sy(p.y),r=sr(p.r||1);
      var col=p.color||PAL.series[i%PAL.series.length];
      var c=_el('circle',{cx:cx,cy:cy,r:r,fill:col,'fill-opacity':.55,stroke:col,'stroke-width':1.5,style:'cursor:pointer;transition:fill-opacity .15s'},g);
      c.addEventListener('mouseenter',function(e){c.setAttribute('fill-opacity',.85);_ttShow('<b>'+_esc(p.label||'')+'</b><br>'+(opts.xLabel||'x')+': '+p.x+'<br>'+(opts.yLabel||'y')+': '+p.y+'<br>taille : '+p.r,e);});
      c.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(p.label||'')+'</b><br>'+(opts.xLabel||'x')+': '+p.x+'<br>'+(opts.yLabel||'y')+': '+p.y+'<br>taille : '+p.r,e);});
      c.addEventListener('mouseleave',function(){c.setAttribute('fill-opacity',.55);_ttHide();});
    });
  }

  // ─── SANKEY (simplified) ─────────────────────────────────────────────────
  // nodes: [{id, label, color?}] | links: [{source, target, value}]
  // Algo : 2 colonnes (left=sources, right=targets) reliées par paths Bézier épais.
  // Pour MTG : Format → Archétype, Couleur → Type, etc.
  function sankey(host,nodes,links,opts){
    host=_mount(host);if(!host||!nodes||!nodes.length||!links||!links.length)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var pad={top:10,right:10,bottom:10,left:10};
    var iw=d.w-pad.left-pad.right, ih=d.h-pad.top-pad.bottom;
    // Identifier sources et targets (par défaut : nodes mentionnés comme source vs target)
    var srcIds={},tgtIds={};
    links.forEach(function(l){srcIds[l.source]=true;tgtIds[l.target]=true;});
    var sources=nodes.filter(function(n){return srcIds[n.id]&&!tgtIds[n.id];});
    var targets=nodes.filter(function(n){return tgtIds[n.id]&&!srcIds[n.id];});
    // Si un node est à la fois src+tgt, on le met dans une 3e colonne mais on simplifie : on l'ajoute aux deux
    var inter=nodes.filter(function(n){return srcIds[n.id]&&tgtIds[n.id];});
    if(inter.length){sources=sources.concat(inter);targets=targets.concat(inter);}
    // Calcul des totaux par node
    var nodeTot={};
    nodes.forEach(function(n){nodeTot[n.id]=0;});
    links.forEach(function(l){nodeTot[l.source]=(nodeTot[l.source]||0)+l.value;nodeTot[l.target]=(nodeTot[l.target]||0)+l.value;});
    var totalFlow=links.reduce(function(s,l){return s+l.value;},0);
    if(!totalFlow)return;
    // Layout positions (sources à gauche, targets à droite, y proportionnel)
    var nodeBox={};var nodeW=14;
    var srcTot=sources.reduce(function(s,n){return s+nodeTot[n.id];},0);
    var tgtTot=targets.reduce(function(s,n){return s+nodeTot[n.id];},0);
    var gapBetween=4;
    var srcGap=(ih-(srcTot/Math.max(srcTot,tgtTot))*ih)/Math.max(1,sources.length-1);
    var ySrc=0;
    sources.forEach(function(n){
      var h0=Math.max(8,(nodeTot[n.id]/Math.max(srcTot,tgtTot))*ih);
      nodeBox[n.id+'-src']={x:pad.left,y:pad.top+ySrc,w:nodeW,h:h0,n:n,t:nodeTot[n.id]};
      ySrc+=h0+gapBetween;
    });
    var yTgt=0;
    targets.forEach(function(n){
      var h0=Math.max(8,(nodeTot[n.id]/Math.max(srcTot,tgtTot))*ih);
      nodeBox[n.id+'-tgt']={x:pad.left+iw-nodeW,y:pad.top+yTgt,w:nodeW,h:h0,n:n,t:nodeTot[n.id]};
      yTgt+=h0+gapBetween;
    });
    var svg=_svg(host,d.w,d.h);
    // Tracker des offsets cumulés par node
    var srcOff={},tgtOff={};
    sources.forEach(function(n){srcOff[n.id]=0;});
    targets.forEach(function(n){tgtOff[n.id]=0;});
    // Tri des links par source-y puis target-y pour empilement stable
    links.sort(function(a,b){
      var sa=sources.findIndex(function(n){return n.id===a.source;});
      var sb=sources.findIndex(function(n){return n.id===b.source;});
      return sa-sb;
    });
    // Render links
    links.forEach(function(l){
      var sBox=nodeBox[l.source+'-src'];var tBox=nodeBox[l.target+'-tgt'];
      if(!sBox||!tBox)return;
      var sRatio=l.value/sBox.t, tRatio=l.value/tBox.t;
      var sH=sBox.h*sRatio, tH=tBox.h*tRatio;
      var sY=sBox.y+srcOff[l.source];
      var tY=tBox.y+tgtOff[l.target];
      srcOff[l.source]+=sH; tgtOff[l.target]+=tH;
      var x1=sBox.x+sBox.w, x2=tBox.x;
      var cx=(x1+x2)/2;
      var path='M '+x1+','+sY+' C '+cx+','+sY+' '+cx+','+tY+' '+x2+','+tY+
               ' L '+x2+','+(tY+tH)+' C '+cx+','+(tY+tH)+' '+cx+','+(sY+sH)+' '+x1+','+(sY+sH)+' Z';
      var col=l.color||sBox.n.color||PAL.series[0];
      var p=_el('path',{d:path,fill:col,'fill-opacity':.25,style:'cursor:pointer;transition:fill-opacity .15s'},svg);
      p.addEventListener('mouseenter',function(e){p.setAttribute('fill-opacity',.55);_ttShow('<b>'+_esc(sBox.n.label)+' → '+_esc(tBox.n.label)+'</b><br>'+l.value+(opts.unit||''),e);});
      p.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(sBox.n.label)+' → '+_esc(tBox.n.label)+'</b><br>'+l.value+(opts.unit||''),e);});
      p.addEventListener('mouseleave',function(){p.setAttribute('fill-opacity',.25);_ttHide();});
    });
    // Render node rectangles + labels
    [sources,targets].forEach(function(arr,colIdx){
      var key=colIdx===0?'-src':'-tgt';
      arr.forEach(function(n){
        var b=nodeBox[n.id+key];if(!b)return;
        var col=n.color||PAL.series[0];
        _el('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:col,rx:2},svg);
        var lblX=colIdx===0?b.x-4:b.x+b.w+4;
        var anchor=colIdx===0?'end':'start';
        _txt(svg,lblX,b.y+b.h/2+3,n.label,{anchor:anchor,baseline:'central',size:10,weight:600,fill:PAL.text});
        _txt(svg,lblX,b.y+b.h/2+15,nodeTot[n.id]+(opts.unit||''),{anchor:anchor,baseline:'central',size:9,fill:PAL.textDim});
      });
    });
  }

  // ─── SUNBURST (multi-niveau hierarchical) ──────────────────────────────────
  // hierarchy: {label, value?, color?, children?:[{...}]}
  // Affiche des arcs concentriques par niveau de profondeur, drill-down au click.
  function sunburst(host,root,opts){
    host=_mount(host);if(!host||!root)return;
    opts=opts||{};
    var d=_dim(host,opts);
    var cx=d.w/2, cy=d.h/2, maxR=Math.min(d.w,d.h)/2-12;
    // Calcule value par node (somme récursive)
    function computeValue(n){
      if(n.children&&n.children.length){n.value=n.children.reduce(function(s,c){return s+computeValue(c);},0);return n.value;}
      return n.value||0;
    }
    computeValue(root);
    if(!root.value)return;
    // Calcule la profondeur
    function maxDepth(n,d){d=d||0;if(!n.children||!n.children.length)return d;return Math.max.apply(null,n.children.map(function(c){return maxDepth(c,d+1);}));}
    var depth=maxDepth(root)||1;
    var ringW=maxR/depth;
    var svg=_svg(host,d.w,d.h);
    // Render arcs récursif
    function renderArcs(node,startAng,endAng,level,parentCol){
      if(level>depth||!node.children)return;
      var totV=node.value;if(!totV)return;
      var ang=startAng;
      node.children.forEach(function(c,i){
        var pct=c.value/totV;
        var sw=pct*(endAng-startAng);
        var inR=level*ringW;
        var outR=(level+1)*ringW;
        var col=c.color||parentCol||PAL.series[i%PAL.series.length];
        // Arc path
        var x1=cx+Math.cos(ang)*inR, y1=cy+Math.sin(ang)*inR;
        var x2=cx+Math.cos(ang)*outR, y2=cy+Math.sin(ang)*outR;
        var x3=cx+Math.cos(ang+sw)*outR, y3=cy+Math.sin(ang+sw)*outR;
        var x4=cx+Math.cos(ang+sw)*inR, y4=cy+Math.sin(ang+sw)*inR;
        var large=sw>Math.PI?1:0;
        var path='M '+x1+','+y1+' L '+x2+','+y2+' A '+outR+','+outR+' 0 '+large+' 1 '+x3+','+y3+' L '+x4+','+y4+' A '+inR+','+inR+' 0 '+large+' 0 '+x1+','+y1+' Z';
        var p=_el('path',{d:path,fill:col,'fill-opacity':0.6,stroke:'#0a0805','stroke-width':1.5,style:'cursor:pointer;transition:fill-opacity .15s'},svg);
        p.addEventListener('mouseenter',function(e){p.setAttribute('fill-opacity',1);_ttShow('<b>'+_esc(c.label)+'</b><br>'+c.value+(opts.unit||'')+' ('+(pct*100).toFixed(1)+'%)',e);});
        p.addEventListener('mousemove',function(e){_ttShow('<b>'+_esc(c.label)+'</b><br>'+c.value+(opts.unit||'')+' ('+(pct*100).toFixed(1)+'%)',e);});
        p.addEventListener('mouseleave',function(){p.setAttribute('fill-opacity',0.6);_ttHide();});
        // Label si l'arc est assez grand
        if(sw>0.18){
          var midAng=ang+sw/2;
          var lblR=(inR+outR)/2;
          var lx=cx+Math.cos(midAng)*lblR, ly=cy+Math.sin(midAng)*lblR;
          _txt(svg,lx,ly,c.label.length>10?c.label.slice(0,9)+'…':c.label,{anchor:'middle',baseline:'central',size:9,weight:600,fill:'#0a0805'});
        }
        // Récursion
        renderArcs(c,ang,ang+sw,level+1,col);
        ang+=sw;
      });
    }
    renderArcs(root,-Math.PI/2,Math.PI*1.5,0,null);
    // Centre
    _el('circle',{cx:cx,cy:cy,r:ringW-3,fill:'#0a0805',stroke:'rgba(255,255,255,.1)','stroke-width':1},svg);
    if(opts.centerText)_txt(svg,cx,cy-4,opts.centerText,{anchor:'middle',baseline:'central',size:13,weight:700,fill:PAL.text});
    if(opts.centerSubtitle)_txt(svg,cx,cy+10,opts.centerSubtitle,{anchor:'middle',baseline:'central',size:9,fill:PAL.textDim});
  }

  // EXPORT
  return {bar:bar,line:line,radar:radar,pie:pie,heatmap:heatmap,histogram:histogram,treemap:treemap,kpi:kpi,sparkline:sparkline,activityHeatmap:activityHeatmap,timeline:timeline,pips:pips,PAL:PAL,countUp:countUp,skeleton:skeleton,observeReveal:observeReveal,bubble:bubble,sankey:sankey,sunburst:sunburst};
})();
