const DELETE_FUNCTION='https://cliakkaotglliowwxtsz.supabase.co/functions/v1/upload-book';
window.deleteBook=async function(id,title){
  if(!window.uploadPasswordSession){alert('أدخل كلمة المرور أولًا');return;}
  if(!confirm('هل أنت متأكد من حذف كتاب «'+String(title||'')+'»؟')) return;
  const fd=new FormData();
  fd.append('password',window.uploadPasswordSession);
  fd.append('action','delete');
  fd.append('id',id);
  try{
    const r=await fetch(DELETE_FUNCTION,{method:'POST',body:fd,cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'فشل حذف الكتاب');
    if(typeof window.loadCloudBooks==='function') await window.loadCloudBooks();
    alert('تم حذف الكتاب بنجاح ✅');
  }catch(e){alert('❌ '+(e.message||'فشل حذف الكتاب'));}
};
