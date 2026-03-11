import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiClient } from "../../../lib/api/client"

export default function FarmChat() {
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<any[]>([])

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiClient.post("/ai/ask", {
        farm_id: "demo-farm",
        question: q
      })
      return (res as any).data
    },
    onSuccess: (data) => {
      setMessages((msgs) => [...msgs, { role: "ai", content: data.answer, context: data.simulation_results }])
    }
  })

  const handleSend = () => {
    setMessages((msgs) => [...msgs, { role: "user", content: question }])
    askMutation.mutate(question)
    setQuestion("")
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h2 className="mb-4 text-xl font-bold">FarmChat</h2>
      <div className="mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "ai" ? "text-green-300" : "text-blue-300"}>
            <div>{msg.role === "ai" ? "AI:" : "Jij:"} {msg.content}</div>
            {msg.context && (
              <div className="mt-2">
                <strong>Scenario Analyse:</strong>
                <ul>
                  {msg.context?.map((s:any, idx:number) => (
                    <li key={idx}>
                      {s.scenario?.biomass_to_bsf * 100}% BSF → €{s.result?.profit_estimate}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 p-2 text-white bg-gray-800 rounded"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Stel een AI-vraag..."
        />
        <button
          className="px-4 py-2 text-white bg-green-600 rounded"
          onClick={handleSend}
          disabled={askMutation.isPending || !question.trim()}
        >
          Verstuur
        </button>
      </div>
    </div>
  )
}
