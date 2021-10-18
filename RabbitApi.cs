using System.Collections.Concurrent;
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

        private static readonly TcpListener Listener;
        private static readonly ManualResetEvent ClientConnected;
        public static readonly string Host = "127.0.0.1";
        public static readonly int Port = 1300;
        private static readonly Thread ServerThread;
        private static string ColorBlue(string input) => ConsoleExtensions.Pastel(input, "#00ccff");
        public static void WriteConsoleBlue(string input) => Console.WriteLine(ColorBlue("[API] " + input));
        public static readonly ConcurrentDictionary<string, GameSession> GameSessions = new ConcurrentDictionary<string, GameSession>();
        private static readonly List<AdminApiSession> apiSessions = new List<AdminApiSession>();

        static AdminApiServer()
        {
            Host = Environment.GetEnvironmentVariable("IP");
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
            WriteConsoleBlue($"GameSession started => {characterId}.");
            if (!GameSessions.ContainsKey(characterId.ToString()))
            {
                GameSessions.TryAdd(characterId.ToString(), session);
                return;
            }
            GameSessions[characterId.ToString()] = session;
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
                    ParseBuffer();
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

        private void ParseBuffer()
        {
            string client_message = "";
            for (int i = 0; i < Buffer.Length; i++)
            {
                client_message += (Convert.ToChar(Buffer[i]));
            }

            AdminApiServer.WriteConsoleBlue($"Recieved message => {client_message} ");
            ParseMessage(client_message);
            Array.Clear(Buffer, 0, Buffer.Length);
        }

        private static bool IsSessionValid(GameSession session)
        {
            //need a better way to check session validity
            lock (session)
            {
                if (session != null && session.Player != null && session.Player.Session != null)
                {
                    return true;
                }
            }
            return false;
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

            if (command.Length == 0 || !command[..1].Equals("/"))
            {
                return;
            }

            string[] args2 = command[1..].Split(" ");

            if (!AdminApiServer.GameSessions.TryGetValue(characterId, out GameSession gameSession))
            {
                AdminApiServer.WriteConsoleBlue("Session not found.");
                return;
            }

            //can probably still enter a race condition extremely rarely
            try
            {
                if (!IsSessionValid(gameSession))
                {
                    AdminApiServer.WriteConsoleBlue("Session is not valid. Command not sent.");
                    return;
                }

                if (!GameServer.CommandManager.HandleCommand(new MapleServer2.Commands.Core.GameCommandTrigger(args2, gameSession)))
                {
                    AdminApiServer.WriteConsoleBlue($"No command was found with alias: {args2[0]}");
                }
            }
            catch (Exception ex)
            {
                AdminApiServer.WriteConsoleBlue("Exception when executing command.");
                AdminApiServer.WriteConsoleBlue(ex.ToString());
            }
        }
    }
}
