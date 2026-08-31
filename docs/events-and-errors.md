# Events and errors

Catalog3D dispatches DOM `CustomEvent` objects on the mount target.

## Events

### `catalog3d:ready`

Catalog3D is ready. `Catalog3D.mount()` resolves at the same lifecycle point.
The event has no detail payload (`detail` is `null`).

It fires once per mount. If the iframe reloads afterwards the loader
re-initializes it silently; the event does not fire again.

### `catalog3d:room-ready`

The shopper's room is ready for room-dependent actions such as object removal.
The event has no detail payload (`detail` is `null`).

It may fire more than once, so handlers should be idempotent. A room-dependent
request can still reject with `ROOM_NOT_READY` if the room changes after an
earlier event.

### `catalog3d:error`

```ts
type Catalog3DErrorDetail = {
  code: Catalog3DErrorCode;
  message: string;
};
```

The error event is used for both lifecycle failures and rejected commands.

## Stable error codes

- `BUSY`: another incompatible request is active. The loader raises this itself
  when `requestRemoval()` is called while one is already in flight.
- `FRAME_LOAD_FAILED`: Catalog3D could not load. Handle this and `TIMEOUT` as
  unavailable states.
- `INTERNAL_ERROR`: Catalog3D could not complete the operation safely.
- `INVALID_CONFIG`: public mount configuration failed validation.
- `INVALID_REQUEST`: a command payload failed validation.
- `ORIGIN_DENIED`: the page origin is not registered for the site.
- `PRODUCT_NOT_FOUND`: the product is unavailable or not authorized.
- `ROOM_NOT_READY`: a room-dependent command was sent too early.
- `SITE_NOT_FOUND`: the publishable site registration is unavailable.
- `TARGET_IN_USE`: the target already owns a Catalog3D mount.
- `TARGET_NOT_FOUND`: the target element or selector did not resolve.
- `TIMEOUT`: the frame or command did not acknowledge within its public limit.

Treat messages as shopper-safe explanations, but branch on stable codes:

```js
try {
  await room.requestRemoval({ description });
} catch (error) {
  if (error.code === "ROOM_NOT_READY") {
    showMessage("Upload a room before requesting an edit.");
  } else if (error.code === "BUSY") {
    showMessage("Catalog3D is already working on another edit.");
  } else {
    showMessage(error.message);
  }
}
```
