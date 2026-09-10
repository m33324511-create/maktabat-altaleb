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
    if (action === "verify") {
      if (!uploadPassword || password !== uploadPassword) return json({ error: "كلمة المرور غير صحيحة." }, 401);
      return json({ ok: true });
    }
    const title = String(form.get("title") ?? "").trim();
    const subject = String(form.get("subject") ?? "أخرى").trim() || "أخرى";
    const description = String(form.get("description") ?? "").trim();
    const file = form.get("file");

    if (!uploadPassword || password !== uploadPassword) {
      return json({ error: "كلمة المرور غير صحيحة." }, 401);
    }
    if (!(file instanceof File)) return json({ error: "لم يتم اختيار ملف." }, 400);
    if (file.type !== "application/pdf") return json({ error: "يسمح برفع ملفات PDF فقط." }, 400);
    if (file.size > 50 * 1024 * 1024) return json({ error: "الحد الأقصى لحجم الملف 50MB." }, 400);
    if (!title) return json({ error: "اكتب اسم الكتاب." }, 400);

    const safeBase = title
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "book";
    const path = `${Date.now()}-${crypto.randomUUID()}-${safeBase}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("books")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) return json({ error: "فشل رفع الملف: " + uploadError.message }, 500);

    const { data: publicData } = supabase.storage.from("books").getPublicUrl(path);
    const fileUrl = publicData.publicUrl;

    const { data, error: dbError } = await supabase
      .from("books")
      .insert({ title, subject, description, file_path: path, file_url: fileUrl })
      .select("id,title,subject,description,file_path,file_url,created_at")
      .single();

    if (dbError) {
      await supabase.storage.from("books").remove([path]);
      return json({ error: "تم رفع الملف لكن تعذر حفظ بيانات الكتاب: " + dbError.message }, 500);
    }

    return json({ book: data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع." }, 500);
  }
});
