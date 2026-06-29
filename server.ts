import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for processing universal input
  app.post("/api/freecai/process", async (req, res) => {
    try {
      const { input, currentClientName, existingJobs } = req.body;

      if (!input || !currentClientName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an AI assistant for recruiters. A recruiter has pasted some information about a client named "${currentClientName}".
        The information might be a Job Description (JD), meeting notes, emails, or feedback.
        
        Information:
        """
        ${input}
        """
        
        Extract information and return it in JSON format.
        
        We need to output two things:
        1. A boolean flag 'hasNewJob' to indicate if a new job opening is detected. If it's a JD or clearly mentions opening a new role, set it to true.
        2. A structured object 'jobData' with information about the new job. If 'hasNewJob' is false, you can leave 'jobData' empty or partial.
        3. A structured object 'clientUpdates' with any new information about the client (e.g. culture, budget, key info).

        If 'hasNewJob' is true, generate a comprehensive 'jobData' for the Job Intelligence Report containing:
        - title
        - roleOverview (dept, reportingLine, salaryRange, location)
        - companyContext (array of strings)
        - idealPersona (array of strings)
        - mustHave (array of strings)
        - niceToHave (array of strings)
        - questionsForClient (array of strings)
        - booleanSearch (string)
        - socialPost (string)
        - interviewQuestions (array of strings)
        - timelineSummary (string summarizing what happened in this input to add to timeline)
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hasNewJob: { type: Type.BOOLEAN },
              timelineSummary: { type: Type.STRING },
              clientUpdates: {
                type: Type.OBJECT,
                properties: {
                  culture: { type: Type.STRING },
                  overview: { type: Type.STRING },
                  industry: { type: Type.STRING },
                  keyInfo: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              },
              jobData: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  roleOverview: {
                    type: Type.OBJECT,
                    properties: {
                      dept: { type: Type.STRING },
                      reportingLine: { type: Type.STRING },
                      salaryRange: { type: Type.STRING },
                      location: { type: Type.STRING }
                    }
                  },
                  companyContext: { type: Type.ARRAY, items: { type: Type.STRING } },
                  idealPersona: { type: Type.ARRAY, items: { type: Type.STRING } },
                  mustHave: { type: Type.ARRAY, items: { type: Type.STRING } },
                  niceToHave: { type: Type.ARRAY, items: { type: Type.STRING } },
                  questionsForClient: { type: Type.ARRAY, items: { type: Type.STRING } },
                  booleanSearch: { type: Type.STRING },
                  socialPost: { type: Type.STRING },
                  interviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            required: ["hasNewJob", "timelineSummary", "jobData"]
          }
        }
      });

      const text = response.text;
      if (text) {
        return res.json(JSON.parse(text));
      } else {
        return res.status(500).json({ error: "No response text" });
      }

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process input" });
    }
  });

  // Chat API route for RAG over client data
  app.post("/api/freecai/chat", async (req, res) => {
    try {
      const { message, clientData } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are a helpful AI recruiting assistant. 
        Answer the recruiter's question using the following client data context.
        
        Context:
        ${JSON.stringify(clientData)}
        
        Question: ${message}`,
      });
      
      res.json({ text: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate chat" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
