from fastapi import HTTPException


class BodyLimitMiddleware:
    """Bound streamed bodies too, even when Content-Length is absent."""
    def __init__(self, app, maximum=6 * 1024 * 1024):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        received = 0

        async def bounded_receive():
            nonlocal received
            message = await receive()
            if message['type'] == 'http.request':
                received += len(message.get('body', b''))
                if received > self.maximum:
                    raise HTTPException(413, 'Request body too large.')
            return message

        await self.app(scope, bounded_receive, send)
