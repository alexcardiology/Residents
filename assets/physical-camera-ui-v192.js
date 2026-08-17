const updatePhysicalQrUi=()=>{
  document.querySelectorAll('[data-meet187-scan]').forEach((button)=>{
    if(button.dataset.cameraUi192==='1') return;
    button.dataset.cameraUi192='1';
    button.textContent='Use phone Camera';
  });
};

setInterval(updatePhysicalQrUi,600);
setTimeout(updatePhysicalQrUi,0);
setTimeout(updatePhysicalQrUi,500);

document.addEventListener('click',(event)=>{
  const button=event.target.closest?.('[data-meet187-scan]');
  if(!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  alert('Open your phone Camera app and scan the QR code shown by Admin. The QR will open this portal and check you in automatically.');
},true);
