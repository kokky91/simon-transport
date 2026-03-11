import { useState } from "react"
import FarmChat from "./FarmChat"

export default function FarmChatButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="fixed z-50 px-4 py-2 text-white bg-green-600 rounded-full shadow-lg bottom-6 right-6"
        onClick={() => setOpen(true)}
      >
        AI Chat
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black bg-opacity-40">
          <div className="bg-gray-900 rounded-lg p-4 m-6 w-[400px] max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-green-400">Farm AI Chat</span>
              <button
                className="px-2 py-1 text-white bg-gray-700 rounded"
                onClick={() => setOpen(false)}
              >
                Sluiten
              </button>
            </div>
            <FarmChat />
          </div>
        </div>
      )}
    </>
  )
}
