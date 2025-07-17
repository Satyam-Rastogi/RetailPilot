import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

const ChatBot = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: 'Hello! I\'m your Shop Management Assistant. I can help you with:\n\n• Check customer balances and information\n• View inventory stock levels\n• Find invoices and bills\n• Record payments\n• Create new customers/suppliers\n• And much more!\n\nJust ask me in natural language. For example: "How much does Rahul Verma owe me?" or "Show me unpaid invoices"',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (response.ok) {
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: data.response,
          timestamp: new Date(),
          intent: data.intent,
          action: data.action,
          requiresConfirmation: data.requires_confirmation,
          entities: data.entities,
          apiCalls: data.api_calls,
          data: data.data
        };

        setMessages(prev => [...prev, botMessage]);

        // If action requires confirmation, set it as pending
        if (data.requires_confirmation) {
          setPendingAction({
            message: data.response,
            entities: data.entities,
            apiCalls: data.api_calls
          });
        }
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/chat/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_calls: pendingAction.apiCalls,
          entities: pendingAction.entities
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const successMessage = {
          id: Date.now(),
          type: 'bot',
          content: data.message || 'Action completed successfully!',
          timestamp: new Date(),
          isSuccess: true
        };
        setMessages(prev => [...prev, successMessage]);
      } else {
        throw new Error(data.error || 'Failed to execute action');
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now(),
        type: 'bot',
        content: `Failed to execute action: ${error.message}`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setPendingAction(null);
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    const cancelMessage = {
      id: Date.now(),
      type: 'bot',
      content: 'Action cancelled. Is there anything else I can help you with?',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, cancelMessage]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  const formatMessage = (content) => {
    return content.split('\\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split('\\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const quickActions = [
    'Show me unpaid invoices',
    'Check stock for Cotton Kurta',
    'How much does Priya Sharma owe me?',
    'Show me last 5 bills',
    'List all customers'
  ];

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          Shop Assistant
          <Badge variant="secondary" className="ml-auto">AI Powered</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.isError
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : message.isSuccess
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {formatMessage(message.content)}
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {pendingAction && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 max-w-[80%]">
                  <div className="text-sm text-yellow-800 mb-3">
                    This action requires confirmation. Do you want to proceed?
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={confirmAction}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isLoading}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelAction}
                      disabled={isLoading}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-4 py-2 border-t bg-gray-50">
            <div className="text-xs text-gray-600 mb-2">Quick actions:</div>
            <div className="flex flex-wrap gap-1">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => sendMessage(action)}
                  disabled={isLoading}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your shop..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage(inputMessage)}
              disabled={isLoading || !inputMessage.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatBot;