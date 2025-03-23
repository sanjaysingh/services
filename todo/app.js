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
        const todos = ref([])
        const newTodo = ref('')

        // Methods
        const sendOTP = async () => {
            try {
                loading.value = true
                error.value = ''
                
                // Validate email
                if (!email.value) {
                    throw new Error('Please enter your email address')
                }

                console.log('Attempting to send OTP to:', email.value)
                
                const { data, error: signInError } = await supabaseClient.auth.signInWithOtp({
                    email: email.value,
                    options: {
                        shouldCreateUser: true,
                        emailRedirectTo: window.location.origin
                    }
                })

                if (signInError) {
                    console.error('Sign in error details:', {
                        message: signInError.message,
                        name: signInError.name,
                        status: signInError.status,
                        stack: signInError.stack
                    })
                    
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

                console.log('OTP response:', data)
                
                // Even if data is null, we still want to show the OTP input
                // as Supabase might have sent the email successfully
                otpSent.value = true
                error.value = `Verification code sent to ${email.value}. Please check your inbox and spam folder.`
                
                // Log the current auth state
                const { data: { session } } = await supabaseClient.auth.getSession()
                console.log('Current session:', session)
                
            } catch (err) {
                console.error('Error details:', {
                    message: err.message,
                    name: err.name,
                    stack: err.stack
                })
                
                error.value = err.message || 'An error occurred while sending the code'
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

                console.log('Verifying OTP:', otp.value)
                const { data, error: verifyError } = await supabaseClient.auth.verifyOtp({
                    email: email.value,
                    token: otp.value,
                    type: 'email'
                })

                if (verifyError) {
                    console.error('Verify error:', verifyError)
                    throw verifyError
                }

                console.log('Verify response:', data)
                if (data?.user) {
                    isAuthenticated.value = true
                    await fetchTodos()
                } else {
                    throw new Error('Verification failed. Please try again.')
                }
            } catch (err) {
                console.error('Error:', err)
                error.value = err.message || 'An error occurred while verifying the code'
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
                error.value = err.message
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
                error.value = err.message
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
                error.value = err.message
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
                error.value = err.message
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
                error.value = err.message
            }
        }

        // Check for existing session
        onMounted(async () => {
            const { data: { session } } = await supabaseClient.auth.getSession()
            if (session) {
                isAuthenticated.value = true
                await fetchTodos()
            }
        })

        // Watch for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            isAuthenticated.value = !!session
            if (session) {
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