import React, { useEffect, useState } from "react";
import { Layout, Menu, PageHeader, Icon } from "antd";
import axios from "axios";
import "antd/dist/antd.css";
import "./App.css";

var baseURL = "http://localhost:3000";

const socket = require("socket.io-client")(baseURL);
const { SubMenu } = Menu;
const { Header, Content, Footer, Sider } = Layout;

function App() {
  const [run, setRun] = useState({
    event: {
      head_commit: {
        message: ""
      }
    },
    jobs: {
      build: {
        name: "",
        steps: [
          {
            name: "",
            run: ""
          }
        ]
      }
    }
  });

  function updateScroll() {
    var element = document.getElementById("content");
    element.scrollTop = element.scrollHeight;
  }

  useEffect(() => {
    socket.on("update", run => {
      setRun(run);
    });

    axios.get(`${baseURL}${window.location.pathname}`).then(res => {
      let run = res.data;
      console.log(run);

      for (var jobName in run.jobs) {
        run.jobs[jobName].steps.forEach(step => {
          try {
            function connect() {
              step.ws = new WebSocket(step.realtime);
              step.ws.onmessage = function(event) {
                console.log(event.data);
                let content = document.getElementById("content");
                content.append(event.data);
                updateScroll();
              };
              step.ws.onclose = function(e) {
                console.log(
                  "Socket is closed. Reconnect will be attempted in 1 second.",
                  e.reason
                );
                setTimeout(function() {
                  connect();
                }, 1000);
              };
            }
            connect();
          } catch (e) {
            console.log(e);
          }
        });
      }

      setRun(res.data);
    });
  }, []);

  return (
    <Layout>
      <Header className="header">
        <h1
          style={{ color: "white", fontFamily: "Sacramento", fontSize: "40px" }}
        >
          Workflow
        </h1>
        <div className="logo" />
        <Menu
          theme="dark"
          mode="horizontal"
          defaultSelectedKeys={["2"]}
          style={{ lineHeight: "64px" }}
        ></Menu>
      </Header>
      <Content style={{ padding: "0 50px" }}>
        <PageHeader
          title={run.event.head_commit.message}
          subTitle={run.event.after}
        />
        <Layout style={{ padding: "24px 0", background: "#fff" }}>
          <Sider width={300} style={{ background: "#fff" }}>
            <Menu
              mode="inline"
              defaultSelectedKeys={["0"]}
              defaultOpenKeys={["sub1"]}
              style={{ height: "100%" }}
            >
              {Object.keys(run.jobs).map(jobName => (
                <SubMenu
                  key={run.jobs[jobName].name || jobName}
                  title={
                    <span>
                      {run.jobs[jobName].status != "complete" ? (
                        <Icon type="sync" spin />
                      ) : (
                        <Icon
                          type="check-circle"
                          theme="twoTone"
                          twoToneColor="#52c41a"
                        />
                      )}
                      <b>{run.jobs[jobName].name || jobName}</b>
                    </span>
                  }
                >
                  {run.jobs[jobName].steps.map(step => (
                    <Menu.Item key={step.uses || step.name || step.run}>
                      {step.status == "complete" ? (
                        <Icon type="check-circle" theme="filled" />
                      ) : (
                        <Icon type="sync" spin />
                      )}
                      {step.uses || step.name || step.run}
                    </Menu.Item>
                  ))}
                </SubMenu>
              ))}
            </Menu>
          </Sider>
          <Content
            id="content"
            style={{
              whiteSpace: "pre",
              fontFamily: "monospace",
              fontSize: "10px",
              backgroundColor: "black",
              color: "white",
              padding: "0 24px",
              minHeight: 280,
              overflow: "scroll",
              height: "500px"
            }}
          ></Content>
        </Layout>
      </Content>
      <Footer style={{ textAlign: "center" }}>©2019 @phishy</Footer>
    </Layout>
  );
}

export default App;
