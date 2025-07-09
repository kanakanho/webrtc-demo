package router

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	_ "github.com/lib/pq"
)

type Signal struct {
	SDP      json.RawMessage   `json:"sdp,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
}

var (
	offerSDP    json.RawMessage
	answerSDP   json.RawMessage
	offerCandidates  []json.RawMessage
	answerCandidates []json.RawMessage
)

func signalHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method == http.MethodPost {
		body, _ := io.ReadAll(r.Body)
		log.Printf("[signalHandler] POST body: %s", string(body))
		var s Signal
		err := json.Unmarshal(body, &s)
		if err != nil {
			log.Printf("[signalHandler] json.Unmarshal error: %v", err)
		}
		resp := make(map[string]interface{})

		// SDPの保存
		if len(s.SDP) > 0 {
			// SDPのtypeを判別
			var sdpObj map[string]interface{}
			_ = json.Unmarshal(s.SDP, &sdpObj)
			sdpType, _ := sdpObj["type"].(string)
			if sdpType == "offer" {
				// 新しいofferが来たら全リセット
				offerSDP = s.SDP
				answerSDP = nil
				offerCandidates = nil
				answerCandidates = nil
				log.Println("[signalHandler] offerSDP set & state reset")
			} else if sdpType == "answer" {
				answerSDP = s.SDP
				log.Println("[signalHandler] answerSDP set")
			}
		}
		// candidateの保存
		if len(s.Candidate) > 0 {
			if answerSDP == nil {
				offerCandidates = append(offerCandidates, s.Candidate)
				log.Printf("[signalHandler] offerCandidate appended, total: %d", len(offerCandidates))
			} else {
				answerCandidates = append(answerCandidates, s.Candidate)
				log.Printf("[signalHandler] answerCandidate appended, total: %d", len(answerCandidates))
			}
		}

		// 返却ロジック
		// クライアントの種類を判別（SDP/candidateが空のPOSTはポーリング目的とみなす）
		isPolling := len(s.SDP) == 0 && len(s.Candidate) == 0
		if isPolling {
			// ポーリング時は、answerSDPがあればOffererに返す、なければAnswererにはofferSDPを返す
			if answerSDP != nil {
				resp["sdp"] = answerSDP
				if len(answerCandidates) > 0 {
					resp["candidates"] = answerCandidates
				} else {
					resp["candidates"] = nil
				}
				log.Printf("[signalHandler] return to offerer: answerSDP=%v, answerCandidates=%d", answerSDP != nil, len(answerCandidates))
			} else {
				resp["sdp"] = offerSDP
				if len(offerCandidates) > 0 {
					resp["candidates"] = offerCandidates
				} else {
					resp["candidates"] = nil
				}
				log.Printf("[signalHandler] return to answerer: offerSDP=%v, offerCandidates=%d", offerSDP != nil, len(offerCandidates))
			}
		} else {
			// SDP/candidateが送信された場合は従来通り保存のみ
		}
		w.Header().Set("Content-Type", "application/json")
		log.Printf("[signalHandler] response: %s", toJSONString(resp))
		err = json.NewEncoder(w).Encode(resp)
		if err != nil {
			log.Printf("[signalHandler] json.Encode error: %v", err)
		}
	} else {
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Hello, World!"))
}

// JSONを文字列化するユーティリティ
func toJSONString(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "<marshal error>"
	}
	return string(b)
}

func Init() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/hello", helloHandler)
	mux.HandleFunc("/api/signal", signalHandler)

	err := http.ListenAndServe(":8000", mux)
	if err != nil {
		log.Println("ListenAndServe: ", err)
	}
}