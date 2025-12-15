export default async () => {
  return new Response(
    JSON.stringify({ ok: true, where: "edge function" }),
    { headers: { "content-type": "application/json" } }
  );
};
