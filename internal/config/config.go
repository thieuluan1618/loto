package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	AIProvider string
	Server     ServerConfig
	Database   DatabaseConfig
	OpenAI     OpenAIConfig
	GoogleAI   GoogleAIConfig
	Vision     VisionConfig
}

type GoogleAIConfig struct {
	APIKey   string
	Model    string
	Thinking string
	Timeout  time.Duration
}

type ServerConfig struct {
	Port            string
	MaxUploadSizeMB int64
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.DBName, d.SSLMode,
	)
}

type OpenAIConfig struct {
	APIKey          string
	Model           string
	ReasoningEffort string
	Timeout         time.Duration
}

type VisionConfig struct {
	CredentialsFile string
	Enabled         bool
}

func Load() (*Config, error) {
	maxUpload, _ := strconv.ParseInt(getEnv("MAX_UPLOAD_SIZE_MB", "5"), 10, 64)

	return &Config{
		AIProvider: getEnv("AI_PROVIDER", "google"),
		Server: ServerConfig{
			Port:            getEnv("SERVER_PORT", "8080"),
			MaxUploadSizeMB: maxUpload,
			ReadTimeout:     30 * time.Second,
			WriteTimeout:    90 * time.Second,
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			DBName:   getEnv("DB_NAME", "loto"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		OpenAI: OpenAIConfig{
			APIKey:          getEnv("OPENAI_API_KEY", ""),
			Model:           getEnv("OPENAI_MODEL", "gpt-5.2"),
			ReasoningEffort: getEnv("OPENAI_REASONING_EFFORT", ""),
			Timeout:         90 * time.Second,
		},
		GoogleAI: GoogleAIConfig{
			APIKey:   getEnv("GOOGLE_API_KEY", ""),
			Model:    getEnv("GOOGLE_AI_MODEL", "gemini-3-flash-preview"),
			Thinking: getEnv("GOOGLE_AI_THINKING", "minimal"),
			Timeout:  90 * time.Second,
		},
		Vision: VisionConfig{
			CredentialsFile: getEnv("GOOGLE_VISION_CREDENTIALS", ""),
			Enabled:         getEnv("GOOGLE_VISION_ENABLED", "true") == "true",
		},
	}, nil
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
