let navyTimer=0;
function rgb(value){
  const m=String(value||"").match(/rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s\/]+(\d+(?:\.\d+)?))?\)/i);
  return m?{r:+m[1],g:+m[2],b:+m[3],a:m[4]==null?1:+m[4]}:null;
}
function deepNavy(style){
  const c=rgb(style.backgroundColor);if(!c||c.a<.55)return false;
  const lum=(.2126*c.r+.7152*c.g+.0722*c.b)/255;
  return lum<.28 && c.b>=c.r*1.18 && c.b>=c.g*1.08;
}
function mark(){
  const roots=[document.querySelector("#content"),document.querySelector("#modalBody"),document.querySelector("aside")].filter(Boolean);
  roots.forEach(root=>{
    root.querySelectorAll("*").forEach(el=>{
      let style;try{style=getComputedStyle(el)}catch(_){return}
      if(deepNavy(style))el.classList.add("auto-navy-surface");else el.classList.remove("auto-navy-surface");
    });
  });
}
function schedule(){clearTimeout(navyTimer);navyTimer=setTimeout(mark,80)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
window.addEventListener("hashchange",schedule);setInterval(mark,5000);mark();
