export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

export const badRequest = (message: string) => json({ error: message }, 400)
export const unauthorized = (message = 'Unauthorized') => json({ error: message }, 401)
export const forbidden = (message = 'Forbidden') => json({ error: message }, 403)
