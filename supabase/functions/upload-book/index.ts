import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const uploadPassword = Deno.env.get("UPLOAD_PASSWORD")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();
    const password = String(form.get("password") ?? "");
    const action = String(form.get("action") ?? "upload");
    if (action === "delete") {
      if (!uploadPassword || password !== uploadPassword) return json({ error: "كلمة المرور غير صحيحة." }, 401);
      const id = String(form.get("id") ?? "").trim();
      if (!id) return json({ error: "معرّف الكتاب غير موجود." }, 400);
      const { data: book, error: findError } = await supabase.from("books").select("id,file_path,cover_path,cover_url").eq("id", id).maybeSingle();
      if (findError) return json({ error: "تعذر العثور على الكتاب: " + findError.message }, 500);
      if (!book) return json({ error: "الكتاب غير موجود." }, 404);
      if (book.file_path) await supabase.storage.from("books").remove([book.file_path]);
      let coverPath = book.cover_path;
      if (!coverPath && book.cover_url) {
        const marker = "/storage/v1/object/public/covers/";
        const idx = String(book.cover_url).indexOf(marker);
        if (idx >= 0) coverPath = String(book.cover_url).slice(idx + marker.length).split("?")[0];
      }
      if (coverPath) await supabase.storage.from("covers").remove([coverPath]);
      const { error: deleteError } = await supabase.from("books").delete().eq("id", id);
      if (deleteError) return json({ error: "تعذر حذف بيانات الكتاب: " + deleteError.message }, 500);
      return json({ ok: true, id });
    }
    if (action === "verify") {
      if (!uploadPassword || password !== uploadPassword) return json({ error: "كلمة المرور غير صحيحة." }, 401);
      return json({ ok: true });
    }
    const title=String(form.get("title")??"").trim();
    const subject=String(form.get("subject")??"أخرى").trim()||"أخرى";
    const description=String(form.get("description")??"").trim();
    const externalUrl=String(form.get("external_url")??"").trim();
    const file=form.get("file"); const cover=form.get("cover");
    if(!uploadPassword||password!==uploadPassword)return json({error:"كلمة المرور غير صحيحة."},401);
    if(!title)return json({error:"اكتب اسم الكتاب."},400);
    if(!(file instanceof File)&&!externalUrl)return json({error:"اختر ملف PDF أو ضع رابط الكتاب."},400);
    if(externalUrl&&!/^https?:\/\//i.test(externalUrl))return json({error:"رابط الكتاب غير صحيح."},400);
    if(file instanceof File){if(file.type!=="application/pdf")return json({error:"يسمح برفع ملفات PDF فقط."},400);if(file.size>50*1024*1024)return json({error:"الحد الأقصى 50MB."},400);}
    if(cover instanceof File&&cover.size>5*1024*1024)return json({error:"الحد الأقصى لصورة الغلاف 5MB."},400);
    let path=null; let fileUrl=null;
    if(file instanceof File){const safeBase=title.normalize("NFKD").replace(/[^\p{L}\p{N}\-_ ]/gu,"").trim().replace(/\s+/g,"-").slice(0,80)||"book";path=`${Date.now()}-${crypto.randomUUID()}-${safeBase}.pdf`;const {error}=await supabase.storage.from("books").upload(path,file,{contentType:"application/pdf",upsert:false});if(error)return json({error:"فشل رفع الملف: "+error.message},500);fileUrl=supabase.storage.from("books").getPublicUrl(path).data.publicUrl;}
    let coverPath=null; let coverUrl=null;
    if(cover instanceof File){const ext=(cover.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";coverPath=`${Date.now()}-${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from("covers").upload(coverPath,cover,{contentType:cover.type||"image/jpeg",upsert:false});if(error){if(path)await supabase.storage.from("books").remove([path]);return json({error:"فشل رفع الغلاف: "+error.message},500);}coverUrl=supabase.storage.from("covers").getPublicUrl(coverPath).data.publicUrl;}
    const {data,error:dbError}=await supabase.from("books").insert({title,subject,description,file_path:path,file_url:fileUrl,external_url:externalUrl||null,cover_url:coverUrl,cover_path:coverPath}).select("id,title,subject,description,file_path,file_url,external_url,cover_url,cover_path,created_at").single();
    if(dbError){if(path)await supabase.storage.from("books").remove([path]);if(coverPath)await supabase.storage.from("covers").remove([coverPath]);return json({error:"تعذر حفظ بيانات الكتاب: "+dbError.message},500);}
    return json({book:data});
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع." }, 500);
  }
});
