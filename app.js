const express = require('express');
const app = express();
const fs = require('fs');
const execSync = require('child_process').execSync;
app.use(express.json());

const apiResponse = (res, status = 200) =>
  (data, success = true, errorMsg = null, error = null) =>
    res.status(status).json({
      data,
      success,
      errorMsg,
      error,
    });

const apiError = (res, status = 500) =>
  (errorMsg = null, error = null) =>
    apiResponse(res, status)(null, false, errorMsg, error);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,path');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

app.get('/filemanager/list', (req, res) => {
  const path = req.query.path || '/mnt/lizardfs';

  fs.readdir(path, (err, files) => {
    if (err) {
      return apiError(res)('Cannot read that folder', err);
    }

    const items = (files || []).map((f) => {
      const fpath = `${path}/${f}`;
      let type = 'file';
      let size = 0;
      let createdAt = null;
      let updatedAt = null;
      let goal = 'empty goal';
      try {
        const stat = fs.statSync(fpath);
        type = stat.isDirectory() ? 'dir' : type;
        size = stat.size || size;
        createdAt = stat.birthtimeMs;
        updatedAt = stat.mtimeMs;
        goal = execSync('lizardfs getgoal "' + fpath + '" | cut -d" " -f 2').toString().replace(/(\r\n|\n|\r)/gm, "");
      } catch (e) {
        console.log('error', e);
        return null;
      }
      return {
        name: f,
        path: fpath,
        type,
        size,
        createdAt,
        updatedAt,
        goal,
      };
    }).filter(Boolean);

    return apiResponse(res)(items);
  });
});

app.get('/filemanager/getLFSGoals', (req, res) => {
    const goals = execSync("lizardfs-admin list-goals mfsmaster 9421 --porcelain | cut -d' ' -f2 | egrep '^[0-9]+$' -v ").toString();
    return apiResponse(res)(goals.split('\n'));
});


app.post('/filemanager/setLFSGoal', (req, res) => {
  const goalName = req.body.goalName;
  const isRecursive = req.body.isRecursive;
  const path = req.body.path;

  const goals =  execSync("lizardfs setgoal" + ( isRecursive ? " -r " : " ") + goalName + " " + `/${path}/`);
 return apiResponse(res)(true);
});

app.get('/filemanager/file/content', (req, res) =>
  res.download(req.query.path));

app.listen(8000);
