"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { deleteDeliverableFile, uploadDeliverableFile } from "@/app/admin/dashboard/fileActions";
import { allowedExtensionList, formatFileSize } from "@/lib/deliverableFiles.mjs";

const initialState = { error: "", success: false };

function DeleteFileButton({ file }) {
  const [state, action, pending] = useActionState(deleteDeliverableFile, initialState);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  if (!confirming) {
    return (
      <button
        aria-label={`Remove ${file.file_name}`}
        className="file-remove"
        onClick={() => setConfirming(true)}
        type="button"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={action} className="file-remove-confirm">
      <input name="id" type="hidden" value={file.id} />
      <button className="button button-quiet" onClick={() => setConfirming(false)} type="button">Keep</button>
      <button className="button button-danger" disabled={pending} type="submit">
        {pending ? "Removing..." : "Confirm"}
      </button>
      {state.error ? <span className="form-error">{state.error}</span> : null}
    </form>
  );
}

/** Staff view: list, upload, and remove the files attached to a deliverable. */
export default function DeliverableFiles({ deliverableId, files }) {
  const [state, action, pending] = useActionState(uploadDeliverableFile, initialState);
  const formRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state]);

  return (
    <div className="file-manager">
      {files.length ? (
        <ul className="file-list">
          {files.map((file) => (
            <li className="file-row" key={file.id}>
              <Icon name="file" size={16} />
              <a className="file-link" href={`/files/deliverable/${file.id}`} rel="noreferrer" target="_blank">
                {file.file_name}
              </a>
              <span className="file-size">{formatFileSize(file.size_bytes)}</span>
              <DeleteFileButton file={file} />
            </li>
          ))}
        </ul>
      ) : null}
      <form action={action} className="file-upload" ref={formRef}>
        <input name="deliverable_id" type="hidden" value={deliverableId} />
        <label className="file-input-label">
          <span className="visually-hidden">Attach a file ({allowedExtensionList()})</span>
          <input accept={allowedExtensionList().replaceAll(/(\w+)/g, ".$1")} name="file" required type="file" />
        </label>
        <button className="button button-quiet" disabled={pending} type="submit">
          <Icon name="paperclip" size={16} /> {pending ? "Uploading..." : "Attach"}
        </button>
      </form>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    </div>
  );
}
