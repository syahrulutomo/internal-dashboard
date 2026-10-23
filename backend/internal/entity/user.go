package entity

// Role is a user's authorization role. It gates role-restricted actions such as
// exporting payments (see the payment usecase). The values match the seeded
// accounts and the `role` claim carried in the JWT.
const (
	RoleCS        = "cs"
	RoleOperation = "operation"
)

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
}
