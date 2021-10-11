using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Net.Sockets;
using MapleServer2.Servers.Game;
using Pastel;

namespace RabbitApi
{
    public static class AdminApiServer
    {
        private static readonly CancellationTokenSource Source;
        static readonly TcpListener Listener;
        static readonly ManualResetEvent ClientConnected;
        public static readonly string Host = "127.0.0.1";
        public static readonly int Port = 1300;
        static readonly Thread ServerThread;
        static string ColorBlue(string input) => ConsoleExtensions.Pastel(input, "#00ccff");
        public static void WriteConsoleBlue(string input) => Console.WriteLine(ColorBlue("[API] " + input));
        public static readonly Dictionary<string, GameSession> gameSessions = new Dictionary<string, GameSession>();
        static readonly List<AdminApiSession> apiSessions = new List<AdminApiSession>();
        static AdminApiServer()
        {
            Source = new CancellationTokenSource();
            IPAddress ipAd = IPAddress.Parse(Host);
            Listener = new TcpListener(ipAd, Port);
            Listener.Start();

            ClientConnected = new ManualResetEvent(false);

            WriteConsoleBlue($"API Server started on {Host}:{Port}.");


            ServerThread = new Thread(() =>
            {
                while (!Source.IsCancellationRequested)
                {
                    ClientConnected.Reset();

                    Listener.BeginAcceptTcpClient(AcceptTcpClient, null);

                    ClientConnected.WaitOne();
                }
            });
            ServerThread.Start();

        }

        public static void AddSession(long characterId, GameSession session)
        {
            gameSessions.Add(characterId.ToString(), session);
            WriteConsoleBlue($"GameSession started => {characterId.ToString()}.");
        }

        static void AcceptTcpClient(IAsyncResult result)
        {

            TcpClient client = Listener.EndAcceptTcpClient(result);
            WriteConsoleBlue($"Connection established with {(IPEndPoint) client.Client.RemoteEndPoint}.");

            AdminApiSession newSession = new AdminApiSession(client);
            apiSessions.Add(newSession);

            ClientConnected.Set();

        }

    }
    public class AdminApiSession
    {
        readonly Socket Socket = null!;
        private readonly CancellationTokenSource Source = new CancellationTokenSource();
        private readonly TcpClient Client;
        private Task ApiThread = null!;
        private const int STOP_TIMEOUT = 2000;
        readonly byte[] Buffer = new byte[100];
        readonly NetworkStream NetworkStream;

        public AdminApiSession([NotNull] TcpClient client)
        {
            client.LingerState = new LingerOption(true, 0);
            Client = client;
            NetworkStream = client.GetStream();
            Start();
        }

        public void Disconnect()
        {
            StopThreads();
            if (Connected())
            {
                // Must close socket before network stream to prevent lingering
                Client.Client.Close();
                Client.Close();
                AdminApiServer.WriteConsoleBlue("Disconnected Client.");
            }
        }

        private void StopThreads()
        {
            Source.Cancel();
            ApiThread.Wait(STOP_TIMEOUT);
        }

        public void Start()
        {
            if (ApiThread != null)
            {
                throw new ArgumentException("Session has already been started.");
            }

            ApiThread = new Task(() =>
            {
                try
                {
                    StartRead();
                }
                catch (SystemException ex)
                {
                    AdminApiServer.WriteConsoleBlue("Fatal error for session:{ex} " + ex.ToString());
                    Disconnect();
                }
            });

            ApiThread.Start();
        }

        public bool Connected()
        {
            if (Client?.Client == null)
            {
                return false;
            }

            Socket socket = Client.Client;
            return !((socket.Poll(1000, SelectMode.SelectRead) && (socket.Available == 0)) || !socket.Connected);
        }

        private async void StartRead()
        {
            CancellationToken readToken = Source.Token;
            while (!readToken.IsCancellationRequested)
            {
                try
                {
                    int length = await NetworkStream.ReadAsync(Buffer.AsMemory(0, Buffer.Length), readToken);
                    if (length <= 0)
                    {
                        if (!Connected())
                        {
                            AdminApiServer.WriteConsoleBlue("Client disconnected.");
                            return;
                        }

                        continue;
                    }
                    ParseBuffer(Buffer);
                }
                catch (IOException)
                {
                    Disconnect();
                    return;
                }
                catch (Exception ex)
                {
                    AdminApiServer.WriteConsoleBlue("Exception reading from socket: " + ex.ToString());
                    return;
                }


            }
        }

        public void Stop()
        {
            if (Socket != null)
            {
                Socket.Close();
            }
        }

        void ParseBuffer(byte[] buffer)
        {
            string client_message = "";
            for (int i = 0; i < buffer.Length; i++)
            {
                client_message += (Convert.ToChar(buffer[i]));
            }

            AdminApiServer.WriteConsoleBlue($"Recieved message => {client_message} ");
            ParseMessage(client_message);
        }

        private void ParseMessage(string message)
        {
            string[] args1 = message.Split("*");

            if (args1.Length != 2)
            {
                return;
            }

            string characterId = args1[0];
            string command = args1[1];

            if (command.Length > 0 && command.Substring(0, 1).Equals("/"))
            {
                string[] args2 = command[1..].Split(" ");

                if (AdminApiServer.gameSessions.TryGetValue(characterId, out GameSession gameSession))
                {
                    if (!GameServer.CommandManager.HandleCommand(new MapleServer2.Commands.Core.GameCommandTrigger(args2, gameSession)))
                    {
                        AdminApiServer.WriteConsoleBlue($"No command was found with alias: {args2[0]}");
                    }
                }
                else
                {
                    AdminApiServer.WriteConsoleBlue("Session not found.");
                }

                return;
            }
        }
    }
}
