// Initialize Supabase client
const supabaseUrl = 'https://fkfsjwvffxvngnpbdxif.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZnNqd3ZmZnh2bmducGJkeGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3NTc0MTYsImV4cCI6MjA1ODMzMzQxNn0.pykHPestWX9exGqI_DSQw-4QM8NTx2CyGlVs7lG3LaU'
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey)

// Create Vue app
const { createApp, ref, onMounted } = Vue

const app = createApp({
    setup() {
        // State
        const isAuthenticated = ref(false)
        const email = ref('')
        const otp = ref('')
        const otpSent = ref(false)
        const loading = ref(false)
        const error = ref('')
        const isAlertFading = ref(false)
        const alertTimeout = ref(null)
        const todos = ref([])
        const newTodo = ref('')

        // Methods
        const setError = (message) => {
            error.value = message
            isAlertFading.value = false
            
            // Clear any existing timeout
            if (alertTimeout.value) {
                clearTimeout(alertTimeout.value)
            }
            
            // Set new timeout for fading
            alertTimeout.value = setTimeout(() => {
                isAlertFading.value = true
                // Clear error after fade animation
                setTimeout(() => {
                    error.value = ''
                    isAlertFading.value = false
                }, 300) // Match the CSS transition duration
            }, 10000)
        }

        const sendOTP = async () => {
            try {
                loading.value = true
                error.value = ''
                
                // Validate email
                if (!email.value) {
                    throw new Error('Please enter your email address')
                }

                const { data, error: signInError } = await supabaseClient.auth.signInWithOtp({
                    email: email.value,
                    options: {
                        shouldCreateUser: true
                    }
                })

                if (signInError) {
                    // Check for SMTP specific errors
                    if (signInError.message?.includes('SMTP') || 
                        signInError.message?.includes('email service') ||
                        signInError.message?.includes('mail server')) {
                        throw new Error('Email service error. Please try again in a few minutes.')
                    }
                    
                    // Check for rate limiting
                    if (signInError.message?.includes('rate limit') || 
                        signInError.message?.includes('too many requests')) {
                        throw new Error('Too many attempts. Please try again later.')
                    }
                    
                    throw signInError
                }
                
                otpSent.value = true
                setError(`Verification code sent to ${email.value}. Please check your inbox and spam folder.`)
                
            } catch (err) {
                setError(err.message || 'An error occurred while sending the code')
            } finally {
                loading.value = false
            }
        }

        const verifyOTP = async () => {
            try {
                loading.value = true
                error.value = ''

                // Validate OTP
                if (!otp.value) {
                    throw new Error('Please enter the verification code')
                }

                const { data, error: verifyError } = await supabaseClient.auth.verifyOtp({
                    email: email.value,
                    token: otp.value,
                    type: 'email'
                })

                if (verifyError) {
                    throw verifyError
                }

                if (data?.user) {
                    isAuthenticated.value = true
                    await fetchTodos()
                } else {
                    throw new Error('Verification failed. Please try again.')
                }
            } catch (err) {
                setError(err.message || 'An error occurred while verifying the code')
            } finally {
                loading.value = false
            }
        }

        const signOut = async () => {
            try {
                const { error: signOutError } = await supabaseClient.auth.signOut()
                if (signOutError) throw signOutError
                isAuthenticated.value = false
                otpSent.value = false
                email.value = ''
                otp.value = ''
                todos.value = []
            } catch (err) {
                setError(err.message)
            }
        }

        const fetchTodos = async () => {
            try {
                const { data, error: fetchError } = await supabaseClient
                    .from('todos')
                    .select('*')
                    .order('created_at', { ascending: false })
                if (fetchError) throw fetchError
                todos.value = data
            } catch (err) {
                setError(err.message)
            }
        }

        const addTodo = async () => {
            try {
                const { data: { user } } = await supabaseClient.auth.getUser()
                if (!user) throw new Error('Not authenticated')

                const { data, error: insertError } = await supabaseClient
                    .from('todos')
                    .insert([{ 
                        title: newTodo.value,
                        user_id: user.id
                    }])
                    .select()
                if (insertError) throw insertError
                todos.value.unshift(data[0])
                newTodo.value = ''
            } catch (err) {
                setError(err.message)
            }
        }

        const updateTodo = async (todo) => {
            try {
                const { error: updateError } = await supabaseClient
                    .from('todos')
                    .update({ completed: todo.completed })
                    .eq('id', todo.id)
                if (updateError) throw updateError
            } catch (err) {
                setError(err.message)
            }
        }

        const deleteTodo = async (id) => {
            try {
                const { error: deleteError } = await supabaseClient
                    .from('todos')
                    .delete()
                    .eq('id', id)
                if (deleteError) throw deleteError
                todos.value = todos.value.filter(todo => todo.id !== id)
            } catch (err) {
                setError(err.message)
            }
        }

        // Check for existing session and get user email
        onMounted(async () => {
            const { data: { session } } = await supabaseClient.auth.getSession()
            if (session?.user) {
                isAuthenticated.value = true
                email.value = session.user.email
                await fetchTodos()
            }
        })

        // Watch for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            isAuthenticated.value = !!session
            if (session?.user) {
                email.value = session.user.email
                fetchTodos()
            }
        })

        return {
            isAuthenticated,
            email,
            otp,
            otpSent,
            loading,
            error,
            isAlertFading,
            todos,
            newTodo,
            sendOTP,
            verifyOTP,
            signOut,
            addTodo,
            updateTodo,
            deleteTodo
        }
    }
})

// Mount the app
app.mount('#app') 